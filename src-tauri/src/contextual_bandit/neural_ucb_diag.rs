use anyhow::Result;
use candle_core::{safetensors, DType, Device, Tensor};
use candle_nn::{AdamW, Linear, Module, Optimizer, VarBuilder, VarMap};
use rand::prelude::IndexedRandom;
use rand::seq::SliceRandom;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
// A simple 2-layer neural network with ReLU activation
struct Network {
    w1: Linear,
    w2: Linear,
}

impl Network {
    // Constructor to create the network layers from a VarBuilder
    fn new(vb: VarBuilder, dim: usize, hidden_size: usize) -> Result<Self> {
        let w1 = candle_nn::linear(dim, hidden_size, vb.pp("w1"))?;
        let w2 = candle_nn::linear(hidden_size, 1, vb.pp("w2"))?;
        Ok(Self { w1, w2 })
    }

    // Forward pass through the network
    fn forward(&self, xs: &Tensor) -> Result<Tensor> {
        // W_2 ReLU(W_1(x))
        let xs = self.w1.forward(xs)?;
        let xs = xs.relu()?;
        Ok(self.w2.forward(&xs)?)
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct NeuralUCBDiagConfig {
    pub dim: usize,
    pub hidden_size: usize,
    pub lambda: f32,
    pub nu: f32,
    pub total_param: usize,
}

/// A NeuralUCB-Diagonal implementation of the contextual bandit algorithm.
/// Based on: https://github.com/uclaml/NeuralUCB/blob/master/train.py
/// "Neural Contextual Bandits with UCB-based Exploration"
/// https://arxiv.org/pdf/1911.04462
pub struct NeuralUCBDiag {
    varmap: VarMap,
    network: Network,
    context_list: Vec<Tensor>,
    reward_list: Vec<f32>,
    lambda: f64,
    nu: f64,
    u: Tensor,
    device: Device,
    config: NeuralUCBDiagConfig,
}

impl NeuralUCBDiag {
    /// Creates a new `NeuralUCBDiag` agent.
    pub fn new(
        dim: usize,
        lambda: f32,
        nu: f32,
        hidden_size: usize,
        device: &Device,
    ) -> Result<Self> {
        let varmap = VarMap::new();
        let vb = VarBuilder::from_varmap(&varmap, DType::F32, device);
        let network = Network::new(vb, dim, hidden_size)?;

        let total_param: usize = varmap.all_vars().iter().map(|v| v.elem_count()).sum();

        // Initialize U as lambda * ones vector
        let u = Tensor::ones(total_param, DType::F32, device)?.affine(lambda as f64, 0.0)?;

        let config = NeuralUCBDiagConfig {
            dim,
            hidden_size,
            lambda,
            nu,
            total_param,
        };

        Ok(Self {
            varmap,
            network,
            context_list: vec![],
            reward_list: vec![],
            lambda: lambda as f64,
            nu: nu as f64,
            u,
            device: device.clone(),
            config,
        })
    }

    /// Saves the agent's state to files (model weights and configuration).
    pub fn save<P: AsRef<Path>>(&self, base_path: P) -> Result<()> {
        let base_path = base_path.as_ref();

        // Create directory if it doesn't exist
        fs::create_dir_all(base_path)?;

        // Save configuration to JSON
        let config_path = format!("{}/config.json", base_path.display());
        let config_json = serde_json::to_string_pretty(&self.config)?;
        fs::write(&config_path, config_json)?;

        // Save model weights and u tensor to safetensors
        let model_path = format!("{}/model.safetensors", base_path.display());
        let mut tensors_to_save = HashMap::new();

        // Save network weights using the actual variable names from varmap
        for (name, var) in self.varmap.data().lock().unwrap().iter() {
            tensors_to_save.insert(name.clone(), var.as_tensor().clone());
        }

        // Save the u tensor (diagonal approximation)
        tensors_to_save.insert("u".to_string(), self.u.clone());

        // Save context and reward history as tensors if they exist
        if !self.context_list.is_empty() {
            let contexts = Tensor::cat(&self.context_list, 0)?;
            tensors_to_save.insert("context_history".to_string(), contexts);

            let rewards = Tensor::new(self.reward_list.as_slice(), &self.device)?;
            tensors_to_save.insert("reward_history".to_string(), rewards);
        }

        safetensors::save(&tensors_to_save, &model_path)?;
        Ok(())
    }

    /// Loads an agent from saved files.
    pub fn load<P: AsRef<Path>>(base_path: P, device: &Device) -> Result<Self> {
        let base_path = base_path.as_ref();

        // Load configuration from JSON
        let config_path = format!("{}/config.json", base_path.display());
        let config_json = fs::read_to_string(&config_path)?;
        let config: NeuralUCBDiagConfig = serde_json::from_str(&config_json)?;

        // Create new agent with loaded config
        let varmap = VarMap::new();
        let vb = VarBuilder::from_varmap(&varmap, DType::F32, device);
        let network = Network::new(vb, config.dim, config.hidden_size)?;

        // Load tensors from safetensors
        let model_path = format!("{}/model.safetensors", base_path.display());
        let tensors = safetensors::load(&model_path, device)?;

        // Load network parameters using the actual variable names
        for (name, var) in varmap.data().lock().unwrap().iter() {
            if let Some(loaded_tensor) = tensors.get(name) {
                var.set(loaded_tensor)?;
            }
        }

        // Load the u tensor
        let u = tensors
            .get("u")
            .ok_or_else(|| anyhow::anyhow!("Missing 'u' tensor in saved model"))?
            .clone();

        // Load history if it exists
        let mut context_list = Vec::new();
        let mut reward_list = Vec::new();

        if let (Some(context_tensor), Some(reward_tensor)) = (
            tensors.get("context_history"),
            tensors.get("reward_history"),
        ) {
            let reward_vec = reward_tensor.to_vec1::<f32>()?;
            reward_list = reward_vec;

            // Split context tensor back into individual contexts
            let num_contexts = context_tensor.dim(0)?;
            for i in 0..num_contexts {
                let ctx = context_tensor.narrow(0, i, 1)?;
                context_list.push(ctx);
            }
        }

        Ok(Self {
            varmap,
            network,
            context_list,
            reward_list,
            lambda: config.lambda as f64,
            nu: config.nu as f64,
            u,
            device: device.clone(),
            config,
        })
    }

    /// Selects an arm based on the UCB principle.
    pub fn select(&mut self, context: &Tensor) -> Result<(usize, f32, f32, f32)> {
        // context has shape (arms, dim)
        let mu = self.network.forward(context)?;
        let num_arms = mu.dim(0)?;

        let mut ucb_scores = Vec::with_capacity(num_arms);
        let mut g_list = Vec::with_capacity(num_arms);

        for i in 0..num_arms {
            // Recompute forward pass for each arm to get proper gradients
            let context_i = context.narrow(0, i, 1)?;
            let fx = self.network.forward(&context_i)?;
            let fx_squeezed = fx.squeeze(0)?.squeeze(0)?;
            let fx_scalar = fx_squeezed.to_scalar::<f32>()?;

            // Backward pass to compute gradients
            let grads = fx.backward()?;

            // Collect gradients and flatten them
            let mut grad_vec = Vec::new();
            for var in self.varmap.all_vars() {
                if let Some(grad) = grads.get(&var) {
                    let flat_grad = grad.flatten_all()?;
                    grad_vec.push(flat_grad);
                } else {
                    // If no gradient, use zeros
                    let zeros = Tensor::zeros_like(&var.as_tensor())?;
                    let flat_grad = zeros.flatten_all()?;
                    grad_vec.push(flat_grad);
                }
            }

            let g = Tensor::cat(&grad_vec, 0)?;
            g_list.push(g.clone());

            // Compute UCB score: sigma2 = lambda * nu * g^2 / U
            let g_squared = (&g * &g)?;
            let sigma2 = g_squared
                .broadcast_div(&self.u)?
                .affine(self.lambda * self.nu, 0.0)?;
            let sigma = sigma2.sum_all()?.sqrt()?;

            let sigma_scalar = sigma.to_scalar::<f32>()?;
            let score = fx_scalar + sigma_scalar;
            ucb_scores.push(score);
        }

        // Select arm with highest UCB score
        let chosen_arm = ucb_scores
            .iter()
            .enumerate()
            .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap())
            .map(|(index, _)| index)
            .unwrap();

        // Update U: U += g * g
        let g_chosen = &g_list[chosen_arm];
        let g_squared = (g_chosen * g_chosen)?;
        self.u = (&self.u + &g_squared)?;

        // Calculate statistics for return
        let g_norm = g_chosen.sqr()?.sum_all()?.sqrt()?.to_scalar::<f32>()?;

        // Calculate average sigma and average reward
        let mu_vec = mu.to_vec2::<f32>()?;
        let ave_sigma = ucb_scores
            .iter()
            .enumerate()
            .map(|(i, &score)| score - mu_vec[i][0])
            .sum::<f32>()
            / num_arms as f32;
        let ave_rew = ucb_scores.iter().sum::<f32>() / num_arms as f32;

        Ok((chosen_arm, g_norm, ave_sigma, ave_rew))
    }

    /// Trains the neural network using an efficient mini-batch update.
    #[allow(dead_code)]
    pub fn train_batch(&mut self, context: &Tensor, reward: f32) -> Result<f32> {
        // Step 1: Store the new experience.
        self.context_list.push(context.clone());
        self.reward_list.push(reward);

        // Optional: Keep the buffer from growing infinitely large in a real application.
        // const MAX_BUFFER_SIZE: usize = 10000;
        // if self.context_list.len() > MAX_BUFFER_SIZE {
        //     self.context_list.remove(0);
        //     self.reward_list.remove(0);
        // }

        // Step 2: Sample a mini-batch of experiences to train on.
        const BATCH_SIZE: usize = 32;
        const NUM_TRAIN_STEPS: usize = 10; // Number of gradient updates per call.

        let data_len = self.context_list.len();
        if data_len == 0 {
            return Ok(0.0);
        }

        let mut optimizer = AdamW::new_lr(self.varmap.all_vars(), 0.01)?;
        let mut rng = rand::rng();
        let mut total_loss = 0.0;

        // Step 3: Train for a fixed number of steps on the mini-batch.
        for _ in 0..NUM_TRAIN_STEPS {
            // Create a batch by randomly sampling indices.
            let indices: Vec<usize> = (0..data_len).collect();
            let chosen_indices = indices.choose_multiple(&mut rng, BATCH_SIZE.min(data_len));

            let mut batch_loss = 0.0;
            let mut samples_in_batch = 0;

            for &idx in chosen_indices {
                let c = &self.context_list[idx];
                let r = self.reward_list[idx];

                let pred = self.network.forward(c)?;
                let r_tensor = Tensor::new(&[r], &self.device)?;
                let loss = (pred.broadcast_sub(&r_tensor)?).sqr()?.sum_all()?;

                let grads = loss.backward()?;
                optimizer.step(&grads)?;

                batch_loss += loss.to_scalar::<f32>()?;
                samples_in_batch += 1;
            }

            if samples_in_batch > 0 {
                total_loss += batch_loss / samples_in_batch as f32;
            }
        }

        Ok(total_loss / NUM_TRAIN_STEPS as f32)
    }

    /// Trains the neural network using observed context and reward.
    pub fn train(&mut self, context: &Tensor, reward: f32) -> Result<f32> {
        // Store context and reward
        self.context_list.push(context.clone());
        self.reward_list.push(reward);

        // Create optimizer with learning rate
        let mut optimizer = AdamW::new_lr(self.varmap.all_vars(), 0.01)?;

        let data_len = self.context_list.len();
        let mut indices: Vec<usize> = (0..data_len).collect();
        let mut rng = rand::rng();

        let mut total_loss = 0.0;
        let mut cnt = 0;

        // Train until convergence or max iterations
        loop {
            indices.shuffle(&mut rng);
            let mut batch_loss = 0.0;

            for &idx in &indices {
                let c = &self.context_list[idx];
                let r = self.reward_list[idx];

                // Forward pass
                let pred = self.network.forward(c)?;

                // Compute loss: (pred - reward)^2
                let r_tensor = Tensor::new(&[r], &self.device)?;
                let delta = pred.broadcast_sub(&r_tensor)?;
                let loss = delta.sqr()?.sum_all()?;

                // Backward pass
                let grads = loss.backward()?;
                optimizer.step(&grads)?;

                let loss_val = loss.to_scalar::<f32>()?;
                batch_loss += loss_val;
                total_loss += loss_val;
                cnt += 1;

                // Early stopping condition
                if cnt >= 100 {
                    return Ok(total_loss / 100.0);
                }
            }

            // Convergence check
            if batch_loss / data_len as f32 <= 1e-3 {
                return Ok(batch_loss / data_len as f32);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candle_core::Device;
    use rand::Rng;
    use rand_distr::{Distribution, Normal};
    use std::fs;

    const DUMMY_DIM: usize = 4;
    const DUMMY_ARMS: usize = 2;
    const DUMMY_HIDDEN: usize = 8;
    const DUMMY_LAMBDA: f32 = 0.5;
    const DUMMY_NU: f32 = 0.5;

    /// Test 6: Database-like scenario with synthetic contextual data
    #[test]
    #[ignore = "heavy"]
    fn test_database_like_scenario() -> Result<()> {
        // Setup constants similar to real database scenario
        const EMBEDDING_SIZE: usize = 128; // Simulated embedding size
        const USER_STATES: usize = 7;
        const APP_CATEGORIES: usize = 20;
        const OTHER_FEATURES: usize = 4; // focus_time, hour, day, similarity
        const FEATURE_DIM: usize =
            EMBEDDING_SIZE * 2 + USER_STATES + APP_CATEGORIES + OTHER_FEATURES;
        const HIDDEN_SIZE: usize = 128;

        println!("\n--- Starting Database-like Scenario Test ---");

        let device = Device::Cpu;
        let mut agent = NeuralUCBDiag::new(FEATURE_DIM, 0.01, 0.1, HIDDEN_SIZE, &device)?;
        let mut rng = rand::rng();
        let normal_dist = Normal::new(0.0, 0.1).unwrap();

        // Simulate user states and their assistance preferences
        let user_states = vec![
            ("flowing", 0.2),    // Low assistance preference
            ("struggling", 0.8), // High assistance preference
            ("idle", 0.6),       // Medium assistance preference
            ("focused", 0.25),   // Low assistance preference
            ("learning", 0.65),  // Medium-high assistance preference
        ];

        let mut total_reward = 0.0;
        let mut decisions_count = vec![0, 0]; // [no_assist, assist]
        const NUM_ROUNDS: usize = 100;

        println!(
            "{:^7}|{:^12}|{:^10}|{:^10}|{:^10}",
            "Round", "State", "Action", "Reward", "Avg"
        );
        println!("{}", "-".repeat(55));

        for round in 0..NUM_ROUNDS {
            // Randomly select a user state
            let (state_name, assist_preference) = user_states.choose(&mut rng).unwrap();

            // Generate synthetic context features
            let mut features = Vec::with_capacity(FEATURE_DIM);

            // Add simulated embeddings
            for _ in 0..(EMBEDDING_SIZE * 2) {
                features.push(normal_dist.sample(&mut rng) as f32);
            }

            // Add one-hot encoded user state
            let state_idx = match *state_name {
                "flowing" => 0,
                "struggling" => 1,
                "idle" => 2,
                "focused" => 3,
                "learning" => 4,
                _ => 5,
            };
            for i in 0..USER_STATES {
                features.push(if i == state_idx { 1.0 } else { 0.0 });
            }

            // Add one-hot encoded category (random)
            let category_idx = rng.random_range(0..APP_CATEGORIES);
            for i in 0..APP_CATEGORIES {
                features.push(if i == category_idx { 1.0 } else { 0.0 });
            }

            // Add other features
            features.push(rng.random::<f32>()); // Normalized focus time
            features.push(rng.random::<f32>()); // Hour of day
            features.push(rng.random::<f32>()); // Day of week
            features.push(rng.random::<f32>()); // Keywords similarity

            // Create contexts for both arms
            let context = Tensor::from_vec(features.clone(), (1, FEATURE_DIM), &device)?;
            let contexts_for_agent = Tensor::cat(&[&context, &context], 0)?;

            // Agent makes decision
            let (chosen_arm, _, _, _) = agent.select(&contexts_for_agent)?;
            decisions_count[chosen_arm] += 1;

            // Simulate reward based on user state and action
            let reward = if chosen_arm == 0 {
                // No assist action
                if *assist_preference < 0.3 {
                    0.5 // Good choice for low-preference states
                } else if *assist_preference > 0.7 {
                    -0.3 // Missed opportunity for high-preference states
                } else {
                    0.0 // Neutral
                }
            } else {
                // Assist action
                let accepted = rng.random::<f32>() < *assist_preference;
                if accepted {
                    1.0 * assist_preference // Scaled positive reward
                } else {
                    -0.5 * (1.0 - assist_preference) // Scaled negative reward
                }
            };

            total_reward += reward;

            // Train the agent
            let training_context = contexts_for_agent.narrow(0, chosen_arm, 1)?;
            agent.train_batch(&training_context, reward)?;

            // Print progress
            if round % 20 == 0 || round == NUM_ROUNDS - 1 {
                let action_str = if chosen_arm == 0 {
                    "NoAssist"
                } else {
                    "Assist"
                };
                let avg_reward = total_reward / (round + 1) as f32;
                println!(
                    "| {:<5} | {:<10} | {:<8} | {:>8.2} | {:>8.3}",
                    round + 1,
                    state_name,
                    action_str,
                    reward,
                    avg_reward
                );
            }
        }

        println!("{}", "-".repeat(55));

        // Calculate final statistics
        let avg_reward = total_reward / NUM_ROUNDS as f32;
        let assist_rate = decisions_count[1] as f32 / NUM_ROUNDS as f32;

        println!("\n=== Final Statistics ===");
        println!("Average Reward: {:.3}", avg_reward);
        println!("Assist Rate: {:.1}%", assist_rate * 100.0);
        println!(
            "Decision Distribution: NoAssist={}, Assist={}",
            decisions_count[0], decisions_count[1]
        );

        // Assertions
        assert!(
            avg_reward > -0.1,
            "Average reward {} is too low",
            avg_reward
        );
        assert!(
            assist_rate > 0.2 && assist_rate < 0.8,
            "Assist rate {} is outside reasonable range",
            assist_rate
        );

        Ok(())
    }

    /// Test 1: Verify that the agent is initialized correctly.
    #[test]
    fn test_agent_creation() -> Result<()> {
        let device = Device::Cpu;
        let agent = NeuralUCBDiag::new(DUMMY_DIM, DUMMY_LAMBDA, DUMMY_NU, DUMMY_HIDDEN, &device)?;

        // Check if hyperparameters are set
        assert_eq!(agent.lambda, DUMMY_LAMBDA as f64);
        assert_eq!(agent.nu, DUMMY_NU as f64);

        // Check if history is empty
        assert!(agent.context_list.is_empty());
        assert!(agent.reward_list.is_empty());

        // Check if the 'u' tensor (diagonal of Z) has the correct size
        let total_params: usize = agent.varmap.all_vars().iter().map(|v| v.elem_count()).sum();
        assert_eq!(agent.u.elem_count(), total_params);

        Ok(())
    }

    /// Test 2: Verify that select() returns a valid arm and updates the 'u' tensor.
    #[test]
    fn test_select_and_update() -> Result<()> {
        let device = Device::Cpu;
        let mut agent =
            NeuralUCBDiag::new(DUMMY_DIM, DUMMY_LAMBDA, DUMMY_NU, DUMMY_HIDDEN, &device)?;

        let initial_u_sum = agent.u.sum_all()?.to_scalar::<f32>()?;

        let context = Tensor::randn(0f32, 1f32, (DUMMY_ARMS, DUMMY_DIM), &device)?;
        let (arm, _g_norm, _ave_sigma, _ave_rew) = agent.select(&context)?;

        // Arm index must be valid
        assert!(arm < DUMMY_ARMS);

        let new_u_sum = agent.u.sum_all()?.to_scalar::<f32>()?;

        // The 'u' tensor should have been updated, so its sum must have increased
        assert!(new_u_sum > initial_u_sum);

        Ok(())
    }

    /// Test 3: Verify that train() modifies the network's parameters.
    #[test]
    fn test_training_updates_weights() -> Result<()> {
        let device = Device::Cpu;
        let mut agent =
            NeuralUCBDiag::new(DUMMY_DIM, DUMMY_LAMBDA, DUMMY_NU, DUMMY_HIDDEN, &device)?;

        // Get the initial sum of all parameters
        let initial_param_sum = agent
            .varmap
            .all_vars()
            .iter()
            .map(|v| v.as_tensor().sum_all().unwrap().to_scalar::<f32>().unwrap())
            .sum::<f32>();

        let context = Tensor::randn(0f32, 1f32, (1, DUMMY_DIM), &device)?;
        let reward = 1.0;

        // Run a training step
        agent.train(&context, reward)?;

        // Get the sum of all parameters after training
        let new_param_sum = agent
            .varmap
            .all_vars()
            .iter()
            .map(|v| v.as_tensor().sum_all().unwrap().to_scalar::<f32>().unwrap())
            .sum::<f32>();

        // The parameters should have changed
        let diff = (new_param_sum - initial_param_sum).abs();

        assert!(diff > 1e-6, "Parameters did not change after training");

        Ok(())
    }

    /// Test 4: A more realistic test simulating a learning environment.
    /// This test verifies that the agent can learn a simple linear reward function
    /// over multiple rounds and that its cumulative regret is minimized.
    #[test]
    #[ignore = "heavy"]
    fn test_agent_learns_to_reduce_regret() -> Result<()> {
        // 1. --- SETUP ---
        let device = Device::Cpu;
        let dim = 4;
        let arms = 5;
        let hidden_size = 32;
        let num_rounds = 100;
        let mut agent = NeuralUCBDiag::new(dim, 0.1, 0.1, hidden_size, &device)?;

        // 2. --- DEFINE GROUND TRUTH (The "correct" answer the agent must learn) ---
        // The true reward function is linear: f(x) = x ⋅ w
        let true_weights = Tensor::new(&[0.8f32, -0.5, 1.2, 0.2], &device)?.reshape((dim, 1))?;
        let true_reward_fn = |ctx: &Tensor| ctx.matmul(&true_weights);

        // Add some noise to make it realistic
        let mut rng = rand::rng();
        let noise_dist = Normal::new(0.0, 0.01).unwrap();

        let mut cumulative_regret = 0.0;

        println!("\n--- Starting Learning Simulation (run with `cargo test -- --nocapture`) ---");
        println!(
            "{:^7}|{:^9}|{:^9}|{:^9}|{:^9}|{:^13}|{:^9}",
            "Round", "Chosen", "Optimal", "Reward", "Regret", "Cum. Regret", "Loss"
        );
        println!("{}", "-".repeat(70));

        // 3. --- SIMULATION LOOP ---
        for t in 1..=num_rounds {
            // a. Generate new contexts (choices) for this round
            let contexts = Tensor::randn(0f32, 1f32, (arms, dim), &device)?;

            // b. Find the optimal arm and its true reward (without noise)
            let true_rewards_all_arms = true_reward_fn(&contexts)?;
            let true_rewards_vec = true_rewards_all_arms.flatten_all()?.to_vec1::<f32>()?;
            let (optimal_arm, &max_reward) = true_rewards_vec
                .iter()
                .enumerate()
                .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap())
                .unwrap();

            // c. Agent selects an arm based on what it has learned so far
            let (chosen_arm, _, _, _) = agent.select(&contexts)?;

            // d. Get the reward for the chosen arm (true reward + noise)
            let chosen_context = contexts.narrow(0, chosen_arm, 1)?;
            let observed_reward_noiseless = true_rewards_vec[chosen_arm];
            let noise = noise_dist.sample(&mut rng) as f32;
            let observed_reward = observed_reward_noiseless + noise;

            // e. Calculate the regret for this round
            let regret = max_reward - observed_reward_noiseless;
            cumulative_regret += regret;

            // f. Train the agent on the new data point (context, reward)
            let loss = agent.train(&chosen_context, observed_reward)?;

            // g. Print progress to show the changes over time
            if t % 10 == 0 || t == 1 || t == num_rounds {
                println!(
                    "| {:<5} | {:^7} | {:^7} | {:>8.2} | {:>8.2} | {:>12.2} | {:>8.4}",
                    t, chosen_arm, optimal_arm, observed_reward, regret, cumulative_regret, loss
                );
            }
        }
        println!("{}", "-".repeat(70));
        println!("Final Cumulative Regret: {:.2}", cumulative_regret);

        // 4. --- ASSERTIONS (Verify that learning happened) ---
        // A non-learning, random agent's regret would be much higher.
        // We assert that our agent's regret is well below a loose upper bound.
        let random_choice_regret_bound = num_rounds as f32 * 0.8;
        assert!(
            cumulative_regret < random_choice_regret_bound,
            "Cumulative regret {} was not less than {}",
            cumulative_regret,
            random_choice_regret_bound
        );

        // Check if the network's final predictions are close to the true values.
        let test_context = Tensor::randn(0f32, 1f32, (1, dim), &device)?;

        // Squeeze the [1, 1] tensor down to a scalar before calling .to_scalar()
        let predicted_reward = agent
            .network
            .forward(&test_context)?
            .squeeze(1)?
            .squeeze(0)?
            .to_scalar::<f32>()?;

        let true_reward = true_reward_fn(&test_context)?
            .squeeze(1)?
            .squeeze(0)?
            .to_scalar::<f32>()?;

        let prediction_error = (predicted_reward - true_reward).abs();
        println!(
            "Final prediction error on a random context: {:.4}",
            prediction_error
        );
        assert!(
            prediction_error < 0.5,
            "Final prediction error {} was not less than 0.5",
            prediction_error
        );

        Ok(())
    }

    /// Test 5: Simulates a high-dimensional, two-arm "Assist vs. NoAssist" scenario.
    #[test]
    #[ignore = "heavy"]
    fn test_assist_or_noassist_scenario() -> Result<()> {
        // 1. --- SETUP ---
        const ASSIST_DIM: usize = 200;
        const HIDDEN_SIZE: usize = 128; // A larger hidden layer for a bigger input dim
        const NUM_ROUNDS: usize = 200; // More rounds to learn the complex pattern
        const NO_ASSIST_ARM: usize = 0;
        const ASSIST_ARM: usize = 1;

        let device = Device::Cpu;
        let mut agent = NeuralUCBDiag::new(ASSIST_DIM, 0.01, 0.1, HIDDEN_SIZE, &device)?;

        // 2. --- DEFINE GROUND TRUTH (Simulates the user's hidden preference) ---
        // We create a "secret" set of weights. If context.dot(weights) > 0, the user
        // will accept the assistance. The agent's goal is to learn this function.
        let true_weights = Tensor::randn(0f32, 1.0, (ASSIST_DIM, 1), &device)?;
        let should_accept_assist = |ctx: &Tensor| -> Result<bool> {
            let preference_score = ctx
                .matmul(&true_weights)?
                .squeeze(1)? // Squeeze the tensor from [1, 1]
                .squeeze(0)? // to a scalar before converting.
                .to_scalar::<f32>()?;
            Ok(preference_score > 0.0)
        };

        let mut cumulative_regret = 0.0;
        let mut correct_decisions = 0;

        println!("\n--- Starting Assist/NoAssist Simulation ---");
        println!(
            "{:^7}|{:^12}|{:^12}|{:^9}|{:^9}|{:^13}|{:^9}",
            "Round", "Agent Choice", "Optimal", "Reward", "Regret", "Cum. Regret", "Accuracy"
        );
        println!("{}", "-".repeat(85));

        // 3. --- SIMULATION LOOP ---
        for t in 1..=NUM_ROUNDS {
            // a. A single user context appears for this round.
            let user_context = Tensor::randn(0.0f32, 1.0, (1, ASSIST_DIM), &device)?;

            // b. To fit the model, we create a context for each arm.
            // The "NoAssist" arm's outcome is context-independent, so we can use a zero vector.
            // The "Assist" arm's outcome depends on the actual user context.
            let zero_context = Tensor::zeros((1, ASSIST_DIM), DType::F32, &device)?;
            let contexts_for_agent = Tensor::cat(&[&zero_context, &user_context], 0)?;

            // c. Determine the optimal action and best possible reward for this round.
            let user_would_accept = should_accept_assist(&user_context)?;
            let (optimal_arm, optimal_reward) = if user_would_accept {
                (ASSIST_ARM, 1.0) // Best to offer assist for a reward of 1.
            } else {
                (NO_ASSIST_ARM, 0.0) // Best to not offer, avoiding a rejection (reward 0).
            };

            // d. Agent selects an arm.
            let (chosen_arm, _, _, _) = agent.select(&contexts_for_agent)?;

            // e. Calculate the observed reward based on the agent's choice.
            let observed_reward = if chosen_arm == ASSIST_ARM {
                if user_would_accept {
                    1.0
                } else {
                    -1.0 // Reward is -1 if "Assist" is offered and rejected.
                }
            } else {
                0.0 // Reward is 0 if "NoAssist" is chosen
            };

            // f. Calculate regret and track accuracy.
            let regret = optimal_reward - observed_reward;
            cumulative_regret += regret;
            if chosen_arm == optimal_arm {
                correct_decisions += 1;
            }
            let accuracy = correct_decisions as f32 / t as f32 * 100.0;

            // g. Train the agent on the context and reward for the arm it chose.
            let context_for_training = contexts_for_agent.narrow(0, chosen_arm, 1)?;
            agent.train_batch(&context_for_training, observed_reward)?;
            // if t % 5 == 0 {
            //     agent.train(&context_for_training, observed_reward)?;
            // }

            // h. Print progress.
            let choice_str = if chosen_arm == ASSIST_ARM {
                "Assist"
            } else {
                "NoAssist"
            };
            let optimal_str = if optimal_arm == ASSIST_ARM {
                "Assist"
            } else {
                "NoAssist"
            };
            println!(
                "| {:<5} | {:^12} | {:^12} | {:>8.1} | {:>8.2} | {:>12.2} | {:>7.1}%",
                t, choice_str, optimal_str, observed_reward, regret, cumulative_regret, accuracy
            );
        }
        println!("{}", "-".repeat(85));

        // 4. --- ASSERTIONS ---
        let final_accuracy = correct_decisions as f32 / NUM_ROUNDS as f32;
        println!("Final Accuracy: {:.2}%", final_accuracy * 100.0);

        // The agent should be making the correct decision much more often than random chance (50%).
        assert!(
            final_accuracy > 0.70,
            "Final accuracy {} was not > 70%",
            final_accuracy
        );

        Ok(())
    }

    /// Test 7: Save and load functionality
    #[test]
    fn test_save_and_load() -> Result<()> {
        let device = Device::Cpu;
        let dim = 8;
        let hidden_size = 16;
        let lambda = 0.1;
        let nu = 0.2;

        // Create and train an agent
        let mut original_agent = NeuralUCBDiag::new(dim, lambda, nu, hidden_size, &device)?;

        // Train the agent with some data
        for i in 0..10 {
            let context = Tensor::randn(0f32, 1f32, (1, dim), &device)?;
            let reward = (i as f32) * 0.1;
            original_agent.train(&context, reward)?;
        }

        // Test selection to update the u tensor
        let test_contexts = Tensor::randn(0f32, 1f32, (3, dim), &device)?;
        let (arm1, _, _, _) = original_agent.select(&test_contexts)?;

        // Save the agent first
        let base_path = "test_neural_ucb";
        original_agent.save(base_path)?;

        // Get original predictions and u tensor state after first save
        let test_context = Tensor::randn(0f32, 1f32, (1, dim), &device)?;
        let original_prediction = original_agent
            .network
            .forward(&test_context)?
            .squeeze(1)?
            .squeeze(0)?
            .to_scalar::<f32>()?;

        // Test overwriting by training more and saving again with the same base_path
        let additional_context = Tensor::randn(0f32, 1f32, (1, dim), &device)?;
        original_agent.train(&additional_context, 0.5)?;

        // Get the state after additional training
        let updated_prediction = original_agent
            .network
            .forward(&test_context)?
            .squeeze(1)?
            .squeeze(0)?
            .to_scalar::<f32>()?;
        let updated_u_sum = original_agent.u.sum_all()?.to_scalar::<f32>()?;

        // Save again - this should overwrite the previous save with updated weights
        original_agent.save(base_path)?;

        // Load the agent
        let mut loaded_agent = NeuralUCBDiag::load(base_path, &device)?;

        // Verify configuration matches
        assert_eq!(loaded_agent.config.dim, dim);
        assert_eq!(loaded_agent.config.hidden_size, hidden_size);
        assert_eq!(loaded_agent.config.lambda, lambda);
        assert_eq!(loaded_agent.config.nu, nu);

        // Verify network produces same predictions as the updated (overwritten) model
        let loaded_prediction = loaded_agent
            .network
            .forward(&test_context)?
            .squeeze(1)?
            .squeeze(0)?
            .to_scalar::<f32>()?;

        let prediction_diff = (updated_prediction - loaded_prediction).abs();
        assert!(
            prediction_diff < 1e-6,
            "Predictions differ: {} vs {} (should match updated model after overwrite)",
            updated_prediction,
            loaded_prediction
        );

        // Verify u tensor matches the updated state (after overwrite)
        let loaded_u_sum = loaded_agent.u.sum_all()?.to_scalar::<f32>()?;
        let u_diff = (updated_u_sum - loaded_u_sum).abs();
        assert!(
            u_diff < 1e-6,
            "U tensor differs: {} vs {} (should match updated model after overwrite)",
            updated_u_sum,
            loaded_u_sum
        );

        // Verify that the loaded model is different from the original (proving overwrite worked)
        let original_vs_loaded_diff = (original_prediction - loaded_prediction).abs();
        assert!(
            original_vs_loaded_diff > 1e-6,
            "Loaded model should be different from original after overwrite, but diff was {}",
            original_vs_loaded_diff
        );

        // Verify hyperparameters are preserved
        assert_eq!(loaded_agent.lambda, original_agent.lambda);
        assert_eq!(loaded_agent.nu, original_agent.nu);

        // Test that loaded agent can still make selections
        let (arm2, _, _, _) = loaded_agent.select(&test_contexts)?;

        // Clean up test files
        let _ = fs::remove_dir_all("test_neural_ucb");

        println!("Save/Load test passed!");
        println!("Original prediction: {:.6}", original_prediction);
        println!("Updated prediction: {:.6}", updated_prediction);
        println!("Loaded prediction: {:.6}", loaded_prediction);
        println!("Original arm selection: {}", arm1);
        println!("Loaded agent arm selection: {}", arm2);
        println!(
            "Overwrite test: Original vs Loaded diff = {:.6}",
            original_vs_loaded_diff
        );

        Ok(())
    }
}
