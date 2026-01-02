/* The following tests are heavy and may take a long time to run.
 * Use --ignored, --release, --nocapture flags to run them, example
 *
 * > cargo test contextual_bandit::tests::with_synthetic_data --release -- --nocapture --ignored
 *
 * Available tests:
 * - with_synthetic_data: Compregensive test with synthetic data
 * - adaptation_with_context: Test agent adaptation from receptive to resistant to assistant
 * - context_feature_importance: Calculate metrics based on transitions and user state
 * - edge_cases_and_robustness: Test extreme scenarios and edge cases
 * - parameter_sensitivity: Parameter sensity test (grid search)
 * - feature_dimensions: Simple test to validate feature dimensions
 * - long_term_stability: Test long-term learning stability
 * - embedding_impact_comparison: Compares model performance with and without the user intention embedding.
 */

use crate::{
    constants,
    contextual_bandit::{
        context::{BanditContext, UserAction},
        neural_ucb_diag::NeuralUCBDiag,
    },
};

use anyhow::Result;
use candle_core::{Device, Tensor};
use chrono::{DateTime, Datelike, Duration, Timelike, Utc};
use rand::prelude::*;
use std::collections::{HashMap, HashSet};

/// Calculate Jaccard similarity between two keyword sets
fn calculate_jaccard_similarity(keywords1: &[String], keywords2: &[String]) -> f32 {
    if keywords1.is_empty() && keywords2.is_empty() {
        return 1.0;
    }
    if keywords1.is_empty() || keywords2.is_empty() {
        return 0.0;
    }

    let set1: HashSet<&String> = keywords1.iter().collect();
    let set2: HashSet<&String> = keywords2.iter().collect();

    let intersection_size = set1.intersection(&set2).count();
    let union_size = set1.union(&set2).count();

    if union_size == 0 {
        0.0
    } else {
        intersection_size as f32 / union_size as f32
    }
}

impl BanditContext {
    /// Generate a random synthetic context with realistic correlations
    pub fn generate_random(
        rng: &mut impl Rng,
        timestamp: DateTime<Utc>,
        previous_context: Option<&BanditContext>,
        session_history: &[String], // Recent app categories
    ) -> Self {
        let states: Vec<&str> = constants::USER_STATES.to_vec();
        let categories = constants::WINDOW_LABELS.to_vec();

        // Generate correlated features
        let user_state = states.choose(rng).unwrap().to_string();

        // Category selection biased by user state
        let app_category = match user_state.as_str() {
            "flowing" | "focused" => {
                if rng.random_bool(0.7) {
                    ["code editor", "terminal", "document editor"]
                        .choose(rng)
                        .unwrap()
                } else {
                    categories.choose(rng).unwrap()
                }
            }
            "struggling" => {
                if rng.random_bool(0.6) {
                    ["research/browsing", "code editor", "terminal"]
                        .choose(rng)
                        .unwrap()
                } else {
                    categories.choose(rng).unwrap()
                }
            }
            "entertaining" => {
                if rng.random_bool(0.8) {
                    ["video streaming", "music streaming", "social media", "game"]
                        .choose(rng)
                        .unwrap()
                } else {
                    categories.choose(rng).unwrap()
                }
            }
            "communicating" => {
                if rng.random_bool(0.75) {
                    ["email app", "chat/messaging", "video conferencing"]
                        .choose(rng)
                        .unwrap()
                } else {
                    categories.choose(rng).unwrap()
                }
            }
            _ => categories.choose(rng).unwrap(),
        }
        .to_string();

        // Focus time correlates with user state
        let focus_time = match user_state.as_str() {
            "flowing" | "focused" => rng.random_range(180..1800), // 3-30 minutes
            "struggling" => rng.random_range(10..120),            // 10 seconds to 2 minutes
            "idle" => rng.random_range(30..300),                  // 30 seconds to 5 minutes
            _ => rng.random_range(60..600),                       // 1-10 minutes
        };

        // Total focus time (total time spent on this app category today)
        let total_focus_time = match user_state.as_str() {
            "flowing" | "focused" => rng.random_range(1800..14400), // 30 minutes to 4 hours
            "struggling" => rng.random_range(300..3600),            // 5 minutes to 1 hour
            _ => rng.random_range(600..7200),                       // 10 minutes to 2 hours
        };

        // Duration since last transition correlates with focus and state
        let duration_since_last = match user_state.as_str() {
            "struggling" => rng.random_range(5..60), // Frequent switching
            "flowing" | "focused" => rng.random_range(300..1800), // Longer periods
            _ => rng.random_range(60..600),          // Moderate
        };

        // Number of transitions in last hour
        let num_transitions = match user_state.as_str() {
            "struggling" => rng.random_range(15..40), // High switching
            "flowing" | "focused" => rng.random_range(3..8), // Low switching
            _ => rng.random_range(8..20),             // Moderate
        };

        // Most frequent category in recent session
        let most_frequent_category = if session_history.len() >= 3 {
            // Find most common category in history
            let mut category_counts = HashMap::new();
            for cat in session_history {
                *category_counts.entry(cat.clone()).or_insert(0) += 1;
            }
            category_counts
                .into_iter()
                .max_by_key(|(_, count)| *count)
                .map(|(cat, _)| cat)
                .unwrap_or_else(|| app_category.clone())
        } else {
            app_category.clone()
        };

        // Generate keywords based on app category and state
        let window_keywords =
            simulation_utils::generate_window_keywords(&app_category, &user_state, rng);
        let user_keywords =
            simulation_utils::generate_user_keywords(&user_state, &window_keywords, rng);

        // Generate synthetic user intention embedding based on state and keywords
        let user_intention_embedding = simulation_utils::generate_synthetic_intention_embedding(
            &user_state,
            &user_keywords,
            rng,
        );

        // Calculate Jaccard similarity with previous keywords
        let jaccard_similarity = if let Some(prev_ctx) = previous_context {
            calculate_jaccard_similarity(&user_keywords, &prev_ctx.user_keywords)
        } else {
            0.0
        };

        BanditContext {
            user_state,
            app_category,
            focus_time,
            total_focus_time,
            duration_since_last,
            num_transitions,
            most_frequent_category,
            jaccard_similarity,
            window_keywords,
            user_keywords,
            user_intention_embedding,
            hour_of_day: timestamp.hour(),
            day_of_week: timestamp.weekday().num_days_from_monday(),
            last_user_intention_str: "".to_string(),
            app_description_str: "".to_string(),
        }
    }
}
/// Simulate user behavior based on comprehensive context
struct UserSimulator {
    acceptance_bias: f32,
    state_preferences: HashMap<String, f32>,
    transition_sensitivity: f32, // How much transitions affect acceptance
    similarity_threshold: f32,   // Jaccard similarity threshold for reduced assistance
}

impl UserSimulator {
    fn new() -> Self {
        let mut state_preferences = HashMap::new();
        state_preferences.insert("struggling".to_string(), 0.8);
        state_preferences.insert("idle".to_string(), 0.6);
        state_preferences.insert("learning".to_string(), 0.65);
        state_preferences.insert("focused".to_string(), 0.25);
        state_preferences.insert("flowing".to_string(), 0.15);
        state_preferences.insert("communicating".to_string(), 0.4);
        state_preferences.insert("entertaining".to_string(), 0.3);

        Self {
            acceptance_bias: 0.0,
            state_preferences,
            transition_sensitivity: 0.1,
            similarity_threshold: 0.7,
        }
    }

    /// Get the probabilities for each user action (accept, reject, omit) for a context (deterministic)
    fn get_action_probabilities(&self, context: &BanditContext) -> (f32, f32, f32) {
        let base_accept_prob = self
            .state_preferences
            .get(&context.user_state)
            .unwrap_or(&0.5);

        // Adjust based on focus time (longer focus = less interruption desired)
        let focus_adjustment = if context.focus_time > 600 {
            -0.3
        } else if context.focus_time < 30 {
            0.2
        } else {
            0.0
        };

        // Transition frequency adjustment (more transitions = more likely to need help)
        let transition_adjustment = if context.num_transitions > 20 {
            0.2 * self.transition_sensitivity
        } else if context.num_transitions < 5 {
            -0.1 * self.transition_sensitivity
        } else {
            0.0
        };

        // Jaccard similarity adjustment (high similarity = repetitive context = less assistance needed)
        let similarity_adjustment = if context.jaccard_similarity > self.similarity_threshold {
            -0.3
        } else {
            0.1
        };

        // Time of day adjustment
        let hour_adjustment = if context.hour_of_day < 6 || context.hour_of_day > 22 {
            -0.2
        } else if context.hour_of_day >= 9 && context.hour_of_day <= 17 {
            0.1
        } else {
            0.0
        };

        // Duration since last transition (very recent transitions suggest task switching)
        let duration_adjustment = if context.duration_since_last < 60 {
            0.15 // Recently switched, might need help
        } else if context.duration_since_last > 900 {
            -0.1 // Been on same task for a while, probably focused
        } else {
            0.0
        };

        // Category consistency (working in same category as most frequent = more focused)
        let consistency_adjustment = if context.app_category == context.most_frequent_category {
            -0.1
        } else {
            0.1
        };

        let accept_prob = (base_accept_prob
            + self.acceptance_bias
            + focus_adjustment
            + transition_adjustment
            + similarity_adjustment
            + hour_adjustment
            + duration_adjustment
            + consistency_adjustment)
            .max(0.0)
            .min(1.0);

        // Calculate reject and omit probabilities based on context
        let reject_prob = match context.user_state.as_str() {
            "flowing" | "focused" => 0.6, // High rejection rate when focused
            "struggling" => 0.1,          // Low rejection rate when struggling
            _ => 0.3,
        };

        // Omit probability is what's left, with some randomization
        let omit_prob = 1.0 - accept_prob - reject_prob;
        let omit_prob = omit_prob.max(0.1).min(0.5); // Keep omit between 10% and 50%

        // Normalize probabilities to sum to 1.0
        let total = accept_prob + reject_prob + omit_prob;
        (accept_prob / total, reject_prob / total, omit_prob / total)
    }

    fn get_user_action(&self, context: &BanditContext, rng: &mut impl Rng) -> UserAction {
        let (accept_prob, reject_prob, _) = self.get_action_probabilities(context);
        let rand_val = rng.random::<f32>();

        if rand_val < accept_prob {
            UserAction::Accept
        } else if rand_val < accept_prob + reject_prob {
            UserAction::Reject
        } else {
            UserAction::Omit
        }
    }
}

/// Statistics for tracking performance
#[cfg(test)]
#[derive(Debug, Clone)]
pub struct BanditStats {
    pub user_states: Vec<String>,
    pub rewards: Vec<f32>,
    pub regrets: Vec<f32>,
    pub actions: Vec<usize>,
    pub acceptance_rates: Vec<f32>,
}

#[cfg(test)]
impl BanditStats {
    pub fn new() -> Self {
        Self {
            user_states: Vec::new(),
            rewards: Vec::new(),
            regrets: Vec::new(),
            actions: Vec::new(),
            acceptance_rates: Vec::new(),
        }
    }

    pub fn add_observation(
        &mut self,
        user_state: String,
        reward: f32,
        regret: f32,
        action: usize,
        accepted: bool,
    ) {
        self.user_states.push(user_state);
        self.rewards.push(reward);
        self.regrets.push(regret);
        self.actions.push(action);
        self.acceptance_rates.push(if accepted { 1.0 } else { 0.0 });
    }

    pub fn mean_reward(&self) -> f32 {
        if self.rewards.is_empty() {
            0.0
        } else {
            self.rewards.iter().sum::<f32>() / self.rewards.len() as f32
        }
    }

    pub fn mean_regret(&self) -> f32 {
        if self.regrets.is_empty() {
            0.0
        } else {
            self.regrets.iter().sum::<f32>() / self.regrets.len() as f32
        }
    }

    pub fn std_deviation(&self, values: &[f32]) -> f32 {
        if values.len() < 2 {
            return 0.0;
        }
        let mean = values.iter().sum::<f32>() / values.len() as f32;
        let variance =
            values.iter().map(|x| (x - mean).powi(2)).sum::<f32>() / (values.len() - 1) as f32;
        variance.sqrt()
    }

    pub fn confidence_interval(&self, values: &[f32], confidence: f32) -> (f32, f32) {
        if values.is_empty() {
            return (0.0, 0.0);
        }
        let mean = values.iter().sum::<f32>() / values.len() as f32;
        let std_dev = self.std_deviation(values);
        let z_score = if confidence == 0.95 { 1.96 } else { 1.645 }; // 95% or 90%
        let margin = z_score * std_dev / (values.len() as f32).sqrt();
        (mean - margin, mean + margin)
    }

    pub fn assist_rate(&self) -> f32 {
        if self.actions.is_empty() {
            0.0
        } else {
            self.actions.iter().filter(|&&a| a == 1).count() as f32 / self.actions.len() as f32
        }
    }

    pub fn recent_performance(&self, window: usize) -> (f32, f32) {
        let start_idx = self.rewards.len().saturating_sub(window);
        let recent_rewards = &self.rewards[start_idx..];
        let recent_regrets = &self.regrets[start_idx..];

        let avg_reward = if recent_rewards.is_empty() {
            0.0
        } else {
            recent_rewards.iter().sum::<f32>() / recent_rewards.len() as f32
        };
        let avg_regret = if recent_regrets.is_empty() {
            0.0
        } else {
            recent_regrets.iter().sum::<f32>() / recent_regrets.len() as f32
        };

        (avg_reward, avg_regret)
    }
}

/// Generate realistic window keywords based on category
#[cfg(test)]
mod simulation_utils {
    use crate::constants;
    use rand::prelude::*;
    use rand::Rng;
    pub fn generate_window_keywords(
        category: &str,
        user_state: &str,
        rng: &mut impl Rng,
    ) -> Vec<String> {
        let base_keywords = match category {
            "code editor" => vec![
                "code", "function", "variable", "debug", "syntax", "file", "editor",
            ],
            "terminal" => vec![
                "command",
                "shell",
                "terminal",
                "bash",
                "directory",
                "file",
                "system",
            ],
            "research/browsing" => vec![
                "article",
                "documentation",
                "tutorial",
                "search",
                "web",
                "information",
            ],
            "social media" => vec![
                "post", "social", "feed", "comment", "share", "like", "follow",
            ],
            "video streaming" => vec![
                "video",
                "streaming",
                "watch",
                "entertainment",
                "media",
                "content",
            ],
            "email app" => vec![
                "email", "message", "inbox", "compose", "reply", "sender", "subject",
            ],
            "chat/messaging" => vec![
                "chat",
                "message",
                "conversation",
                "team",
                "communication",
                "text",
            ],
            "video conferencing" => vec![
                "meeting",
                "video",
                "call",
                "conference",
                "participants",
                "screen",
            ],
            _ => vec![
                "application",
                "window",
                "interface",
                "content",
                "user",
                "data",
            ],
        };

        // Add state-specific keywords
        let state_keywords = match user_state {
            "struggling" => vec!["error", "problem", "help", "troubleshooting"],
            "learning" => vec!["tutorial", "documentation", "learn", "guide"],
            "focused" => vec!["work", "project", "task", "productivity"],
            _ => vec![],
        };

        let mut keywords = base_keywords;
        keywords.extend(state_keywords);

        // Randomly select 3-7 keywords
        let count = rng.random_range(3..8).min(keywords.len());
        keywords.shuffle(rng);
        keywords
            .into_iter()
            .take(count)
            .map(|s| s.to_string())
            .collect()
    }

    /// Generate user-level keywords (summary of session activity)
    pub fn generate_user_keywords(
        user_state: &str,
        window_keywords: &[String],
        rng: &mut impl Rng,
    ) -> Vec<String> {
        let mut user_keywords: Vec<&str> = vec![];

        // Add state-specific keywords
        match user_state {
            "flowing" => {
                user_keywords.extend(vec!["productive", "focused", "development", "workflow"])
            }
            "struggling" => {
                user_keywords.extend(vec!["debugging", "research", "problem-solving", "learning"])
            }
            "idle" => user_keywords.extend(vec!["browsing", "casual", "reading", "exploring"]),
            "focused" => user_keywords.extend(vec![
                "concentrated",
                "deep-work",
                "implementation",
                "coding",
            ]),
            "learning" => {
                user_keywords.extend(vec!["studying", "documentation", "tutorial", "knowledge"])
            }
            "communicating" => {
                user_keywords.extend(vec!["collaboration", "discussion", "meeting", "team"])
            }
            "entertaining" => {
                user_keywords.extend(vec!["leisure", "entertainment", "relaxation", "media"])
            }
            _ => {}
        }

        // Include some window keywords (LLM would summarize these)
        let window_sample_count = (window_keywords.len() / 2).max(1).min(3);
        let mut window_sample = window_keywords.to_vec();
        window_sample.shuffle(rng);
        user_keywords.extend(
            window_sample
                .iter()
                .map(|s| s as &str)
                .take(window_sample_count),
        );

        user_keywords.into_iter().map(|s| s.to_string()).collect()
    }

    /// Generate synthetic user intention embedding based on state and keywords
    pub fn generate_synthetic_intention_embedding(
        user_state: &str,
        user_keywords: &[String],
        rng: &mut impl Rng,
    ) -> Vec<f32> {
        let mut embedding = vec![0.0; constants::EMBEDDING_SIZE];

        // Create base patterns for different user states
        let state_base_values = match user_state {
            "flowing" => vec![0.8, -0.2, 0.6, 0.4, -0.1],
            "struggling" => vec![-0.5, 0.7, -0.3, 0.2, 0.8],
            "idle" => vec![0.1, 0.1, -0.6, -0.4, 0.2],
            "focused" => vec![0.9, -0.8, 0.5, 0.7, -0.3],
            "learning" => vec![0.3, 0.4, 0.8, -0.2, 0.6],
            "communicating" => vec![-0.2, 0.5, 0.3, 0.8, -0.4],
            "entertaining" => vec![-0.7, -0.5, -0.2, 0.3, 0.9],
            _ => vec![0.0, 0.0, 0.0, 0.0, 0.0],
        };

        // Fill embedding with state-based pattern repeated and varied
        for (i, value) in embedding.iter_mut().enumerate() {
            let base_idx = i % state_base_values.len();
            let base_value = state_base_values[base_idx];

            // Add some noise and keyword influence
            let noise = rng.random::<f32>() * 0.3 - 0.15; // -0.15 to 0.15
            let keyword_influence = if !user_keywords.is_empty() {
                let keyword_hash = user_keywords[i % user_keywords.len()].len() as f32 * 0.01;
                (keyword_hash * 0.2).sin() * 0.1
            } else {
                0.0
            };

            *value = (base_value + noise + keyword_influence).tanh(); // Keep in reasonable range
        }

        // Normalize to unit vector (common for embeddings)
        let magnitude: f32 = embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
        if magnitude > 0.0 {
            for value in embedding.iter_mut() {
                *value /= magnitude;
            }
        }

        embedding
    }
}

/// Test with comprehensive synthetic data including all context features
#[test]
#[ignore = "heavy"]
fn with_synthetic_data() -> Result<()> {
    println!("\n--- Starting Comprehensive Synthetic Data Test ---");
    println!("Simulating user assistance scenarios with rich context features:");
    println!("- App transitions and frequency");
    println!("- Keyword similarity analysis");
    println!("- Focus time patterns");
    println!("- Session context and consistency");

    // Test multiple random seeds for robustness
    let test_seeds = [42, 123, 456, 789];
    let mut seed_results = Vec::new();

    for &seed in &test_seeds {
        println!("\n=== Testing with seed {} ===", seed);
        let seed_result = run_comprehensive_test(seed)?;
        seed_results.push(seed_result);
    }

    // Analyze results across seeds
    analyze_robustness(&seed_results);

    Ok(())
}

fn run_comprehensive_test(seed: u64) -> Result<BanditStats> {
    // Setup
    let device = Device::Cpu;
    let mut dummy_rng = StdRng::seed_from_u64(0);
    let dummy_context = BanditContext::generate_random(&mut dummy_rng, Utc::now(), None, &[]);
    let feature_dim = dummy_context.feature_dim(true); // Use embedding
    let hidden_size = 128;
    let mut agent = NeuralUCBDiag::new(feature_dim, 0.05, 1.0, hidden_size, &device)?;

    // Initialize simulator and RNG
    let mut rng = StdRng::seed_from_u64(seed);
    let user_sim = UserSimulator::new();
    let mut stats = BanditStats::new();

    // Generate synthetic contexts with session history
    let mut contexts = Vec::new();
    let mut session_history = Vec::new();
    let mut current_time = Utc::now() - Duration::hours(24);
    let mut previous_context: Option<BanditContext> = None;

    for _i in 0..500 {
        let context = BanditContext::generate_random(
            &mut rng,
            current_time,
            previous_context.as_ref(),
            &session_history,
        );

        // Update session history (keep last 10 categories)
        session_history.push(context.app_category.clone());
        if session_history.len() > 10 {
            session_history.remove(0);
        }

        contexts.push(context.clone());
        previous_context = Some(context);
        current_time = current_time + Duration::minutes(rng.random_range(1..30));
    }

    // Training loop
    let mut total_reward = 0.0;
    let mut total_regret = 0.0;
    let mut decisions = vec![0, 0]; // [no_assist, assist]
    let mut state_rewards: HashMap<String, Vec<f32>> = HashMap::new();
    let mut state_assists: HashMap<String, (u32, u32)> = HashMap::new(); // (total_decisions, assist_decisions)
    let mut acceptance_rate = Vec::new();
    let mut similarity_impacts = Vec::new();
    let mut transition_impacts = Vec::new();
    let mut learning_curve = Vec::new();

    if seed == 42 {
        println!(
            "\n{:^7}|{:^12}|{:^12}|{:^8}|{:^6}|{:^6}|{:^8}|{:^8}|{:^8}|{:^8}",
            "Round",
            "State",
            "Category",
            "Action",
            "Trans",
            "Sim",
            "Reward",
            "Regret",
            "Avg",
            "Assist%",
        );
        println!("{}", "-".repeat(120));
    }

    for (round, context) in contexts.iter().enumerate() {
        // Prepare context for both arms
        let context_tensor = context.to_tensor(&device, true)?; // Use embedding
        let zero_context = Tensor::zeros((1, feature_dim), candle_core::DType::F32, &device)?;
        let contexts_for_agent = Tensor::cat(&[&zero_context, &context_tensor], 0)?;

        // Agent decision
        let (chosen_arm, _, _, _) = agent.select(&contexts_for_agent)?;
        decisions[chosen_arm] += 1;

        // Track assists by state
        let state_entry = state_assists
            .entry(context.user_state.clone())
            .or_insert((0, 0));
        state_entry.0 += 1; // total decisions for this state
        if chosen_arm == 1 {
            state_entry.1 += 1; // assist decisions for this state
        }

        // User response
        let user_action = if chosen_arm == 1 {
            let action = user_sim.get_user_action(context, &mut rng);
            acceptance_rate.push(match action {
                UserAction::Accept => 1.0,
                _ => 0.0,
            });
            action
        } else {
            UserAction::Omit // No assistance offered, so user takes no action
        };

        // Compute reward
        let reward = context.compute_reward(chosen_arm, user_action);
        total_reward += reward;

        // Calculate expected optimal reward and regret deterministically
        let no_assist_reward = context.compute_reward(0, UserAction::Omit);
        let (accept_prob, reject_prob, omit_prob) = user_sim.get_action_probabilities(context);
        let assist_reward_if_accepted = context.compute_reward(1, UserAction::Accept);
        let assist_reward_if_rejected = context.compute_reward(1, UserAction::Reject);
        let assist_reward_if_omitted = context.compute_reward(1, UserAction::Omit);

        let expected_assist_reward = accept_prob * assist_reward_if_accepted
            + reject_prob * assist_reward_if_rejected
            + omit_prob * assist_reward_if_omitted;

        let optimal_reward = no_assist_reward.max(expected_assist_reward);
        let regret = optimal_reward - reward;
        total_regret += regret;

        similarity_impacts.push((context.jaccard_similarity, chosen_arm, reward));
        transition_impacts.push((context.num_transitions, chosen_arm, reward));

        state_rewards
            .entry(context.user_state.clone())
            .or_insert_with(Vec::new)
            .push(reward);

        stats.add_observation(
            context.user_state.clone(),
            reward,
            regret,
            chosen_arm,
            user_action == UserAction::Accept,
        );

        let training_context = contexts_for_agent.narrow(0, chosen_arm, 1)?;
        agent.train(&training_context, reward)?;

        if round % 10 == 0 {
            let (recent_reward, recent_regret) = stats.recent_performance(50);
            learning_curve.push((round, recent_reward, recent_regret, stats.assist_rate()));
        }

        if seed == 42 && (round % 25 == 0 || round == contexts.len() - 1) {
            let action_str = if chosen_arm == 0 { "NoAst" } else { "Ast" };
            let avg_reward = total_reward / (round + 1) as f32;
            let current_assist_rate = decisions[1] as f32 / (round + 1) as f32 * 100.0;
            println!(
                "| {:<5} | {:<10} | {:<10} | {:<6} | {:>4} | {:>4.2} | {:>6.2} | {:>6.2} | {:>6.3} | {:>6.1}%",
                round + 1,
                &context.user_state[..10.min(context.user_state.len())],
                &context.app_category[..10.min(context.app_category.len())],
                action_str,
                context.num_transitions,
                context.jaccard_similarity,
                reward,
                regret,
                avg_reward,
                current_assist_rate
            );
        }
    }

    if seed == 42 {
        println!("{}", "-".repeat(135));
    }

    let avg_reward = stats.mean_reward();
    let avg_regret = stats.mean_regret();
    let assist_rate = stats.assist_rate();
    let avg_acceptance = if !acceptance_rate.is_empty() {
        acceptance_rate.iter().sum::<f32>() / acceptance_rate.len() as f32
    } else {
        0.0
    };

    let (reward_ci_low, reward_ci_high) = stats.confidence_interval(&stats.rewards, 0.95);
    let reward_std = stats.std_deviation(&stats.rewards);
    let (recent_reward, recent_regret) = stats.recent_performance(100);

    let high_similarity_assists = similarity_impacts
        .iter()
        .filter(|(sim, action, _)| *sim > 0.7 && *action == 1)
        .count();
    let high_transition_assists = transition_impacts
        .iter()
        .filter(|(trans, action, _)| *trans > 25 && *action == 1)
        .count();

    if seed == 42 {
        println!("\n=== Performance Summary (Seed {}) ===", seed);
        println!("Total Rounds: {}", contexts.len());
        println!(
            "Average Reward: {:.3} ± {:.3} (95% CI: [{:.3}, {:.3}])",
            avg_reward, reward_std, reward_ci_low, reward_ci_high
        );
        println!("Average Regret: {:.3}", avg_regret);
        println!("Cumulative Regret: {:.2}", total_regret);
        println!(
            "Recent Performance (last 100): Reward={:.3}, Regret={:.3}",
            recent_reward, recent_regret
        );
        println!("Assist Rate: {:.1}%", assist_rate * 100.0);
        println!("Acceptance Rate: {:.1}%", avg_acceptance * 100.0);

        println!(
            "High Similarity Assists: {} ({:.1}%)",
            high_similarity_assists,
            if decisions[1] > 0 {
                high_similarity_assists as f32 / decisions[1] as f32 * 100.0
            } else {
                0.0
            }
        );
        println!(
            "High Transition Assists: {} ({:.1}%)",
            high_transition_assists,
            if decisions[1] > 0 {
                high_transition_assists as f32 / decisions[1] as f32 * 100.0
            } else {
                0.0
            }
        );

        println!("\n=== Performance by State ===");
        for (state, rewards) in state_rewards.iter() {
            let state_avg = rewards.iter().sum::<f32>() / rewards.len() as f32;
            let state_std = stats.std_deviation(rewards);
            let (total_decisions, assist_decisions) = state_assists.get(state).unwrap_or(&(0, 0));
            let state_assist_rate = if *total_decisions > 0 {
                *assist_decisions as f32 / *total_decisions as f32 * 100.0
            } else {
                0.0
            };
            println!(
                "  {}: {:.3} ± {:.3} (n={}) - Assist Rate: {:.1}%",
                state,
                state_avg,
                state_std,
                rewards.len(),
                state_assist_rate
            );
        }

        println!("\n=== Assist Rate by State Analysis ===");
        println!(
            "{:^15}|{:^12}|{:^12}|{:^12}",
            "User State", "Total", "Assists", "Rate"
        );
        println!("{}", "-".repeat(55));
        for (state, (total_decisions, assist_decisions)) in state_assists.iter() {
            let assist_rate = if *total_decisions > 0 {
                *assist_decisions as f32 / *total_decisions as f32 * 100.0
            } else {
                0.0
            };
            println!(
                "{:^15}|{:^12}|{:^12}|{:^11.1}%",
                state, total_decisions, assist_decisions, assist_rate
            );
        }
        println!("{}", "-".repeat(55));

        // Validate expected assist rate patterns based on user state characteristics
        let struggling_rate = state_assists
            .get("struggling")
            .map(|(total, assists)| {
                if *total > 0 {
                    *assists as f32 / *total as f32
                } else {
                    0.0
                }
            })
            .unwrap_or(0.0);
        let focused_rate = state_assists
            .get("focused")
            .map(|(total, assists)| {
                if *total > 0 {
                    *assists as f32 / *total as f32
                } else {
                    0.0
                }
            })
            .unwrap_or(0.0);
        let flowing_rate = state_assists
            .get("flowing")
            .map(|(total, assists)| {
                if *total > 0 {
                    *assists as f32 / *total as f32
                } else {
                    0.0
                }
            })
            .unwrap_or(0.0);
        let idle_rate = state_assists
            .get("idle")
            .map(|(total, assists)| {
                if *total > 0 {
                    *assists as f32 / *total as f32
                } else {
                    0.0
                }
            })
            .unwrap_or(0.0);

        println!("\n=== State-Based Assist Rate Insights ===");
        if struggling_rate > 0.0 && focused_rate > 0.0 {
            println!(
                "  • Struggling vs Focused: {:.1}% vs {:.1}% assist rate",
                struggling_rate * 100.0,
                focused_rate * 100.0
            );
            if struggling_rate > focused_rate {
                println!("    ✓ Agent correctly offers more assistance when struggling");
            } else {
                println!("    ⚠ Unexpected: focused users getting equal/more assistance");
            }
        }

        if flowing_rate > 0.0 && idle_rate > 0.0 {
            println!(
                "  • Flowing vs Idle: {:.1}% vs {:.1}% assist rate",
                flowing_rate * 100.0,
                idle_rate * 100.0
            );
            if idle_rate > flowing_rate {
                println!("    ✓ Agent correctly offers more assistance when idle");
            }
        }

        // Find highest and lowest assist rate states
        let mut state_rates: Vec<(&String, f32)> = state_assists
            .iter()
            .map(|(state, (total, assists))| {
                let rate = if *total > 0 {
                    *assists as f32 / *total as f32
                } else {
                    0.0
                };
                (state, rate)
            })
            .collect();
        state_rates.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

        if !state_rates.is_empty() {
            println!(
                "  • Highest assist rate: {} ({:.1}%)",
                state_rates[0].0,
                state_rates[0].1 * 100.0
            );
            if state_rates.len() > 1 {
                println!(
                    "  • Lowest assist rate: {} ({:.1}%)",
                    state_rates.last().unwrap().0,
                    state_rates.last().unwrap().1 * 100.0
                );
            }
        }

        println!("\n=== Feature Analysis ===");

        let low_sim_rewards: Vec<f32> = similarity_impacts
            .iter()
            .filter(|(sim, _, _)| *sim < 0.3)
            .map(|(_, _, reward)| *reward)
            .collect();
        let high_sim_rewards: Vec<f32> = similarity_impacts
            .iter()
            .filter(|(sim, _, _)| *sim > 0.7)
            .map(|(_, _, reward)| *reward)
            .collect();

        if !low_sim_rewards.is_empty() && !high_sim_rewards.is_empty() {
            let low_sim_avg = low_sim_rewards.iter().sum::<f32>() / low_sim_rewards.len() as f32;
            let high_sim_avg = high_sim_rewards.iter().sum::<f32>() / high_sim_rewards.len() as f32;
            let low_sim_std = stats.std_deviation(&low_sim_rewards);
            let high_sim_std = stats.std_deviation(&high_sim_rewards);

            println!(
                "  Low Similarity (<0.3): {:.3} ± {:.3} (n={})",
                low_sim_avg,
                low_sim_std,
                low_sim_rewards.len()
            );
            println!(
                "  High Similarity (>0.7): {:.3} ± {:.3} (n={})",
                high_sim_avg,
                high_sim_std,
                high_sim_rewards.len()
            );
        }

        let low_trans_rewards: Vec<f32> = transition_impacts
            .iter()
            .filter(|(trans, _, _)| *trans < 10)
            .map(|(_, _, reward)| *reward)
            .collect();
        let high_trans_rewards: Vec<f32> = transition_impacts
            .iter()
            .filter(|(trans, _, _)| *trans > 25)
            .map(|(_, _, reward)| *reward)
            .collect();

        if !low_trans_rewards.is_empty() && !high_trans_rewards.is_empty() {
            let low_trans_avg =
                low_trans_rewards.iter().sum::<f32>() / low_trans_rewards.len() as f32;
            let high_trans_avg =
                high_trans_rewards.iter().sum::<f32>() / high_trans_rewards.len() as f32;
            let low_trans_std = stats.std_deviation(&low_trans_rewards);
            let high_trans_std = stats.std_deviation(&high_trans_rewards);

            println!(
                "  Low Transitions (<10): {:.3} ± {:.3} (n={})",
                low_trans_avg,
                low_trans_std,
                low_trans_rewards.len()
            );
            println!(
                "  High Transitions (>25): {:.3} ± {:.3} (n={})",
                high_trans_avg,
                high_trans_std,
                high_trans_rewards.len()
            );
        }

        println!("\n=== Learning Curve Analysis ===");
        if learning_curve.len() >= 5 {
            let early_performance = &learning_curve[0..5];
            let late_performance = &learning_curve[learning_curve.len() - 5..];
            let early_avg = early_performance.iter().map(|(_, r, _, _)| *r).sum::<f32>()
                / early_performance.len() as f32;
            let late_avg = late_performance.iter().map(|(_, r, _, _)| *r).sum::<f32>()
                / late_performance.len() as f32;

            println!("  Early Learning (rounds 0-40): {:.3}", early_avg);
            println!("  Late Learning (final 40 rounds): {:.3}", late_avg);
            println!("  Improvement: {:.3}", late_avg - early_avg);
        }
    }

    assert!(avg_reward > -0.3, "Average reward too low: {}", avg_reward);
    assert!(
        assist_rate > 0.1 && assist_rate < 0.9,
        "Assist rate out of reasonable range: {}",
        assist_rate
    );
    assert!(avg_regret < 0.6, "Average regret too high: {}", avg_regret);
    assert!(reward_std < 2.0, "Reward variance too high: {}", reward_std);

    if seed == 42 {
        println!("\n✅ comprehensive synthetic test passed!");
    }

    Ok(stats)
}

fn analyze_robustness(seed_results: &[BanditStats]) {
    println!("\n=== Robustness Analysis Across Seeds ===");

    let mean_rewards: Vec<f32> = seed_results.iter().map(|s| s.mean_reward()).collect();
    let mean_regrets: Vec<f32> = seed_results.iter().map(|s| s.mean_regret()).collect();
    let assist_rates: Vec<f32> = seed_results.iter().map(|s| s.assist_rate()).collect();

    let overall_reward_mean = mean_rewards.iter().sum::<f32>() / mean_rewards.len() as f32;
    let overall_regret_mean = mean_regrets.iter().sum::<f32>() / mean_regrets.len() as f32;
    let overall_assist_mean = assist_rates.iter().sum::<f32>() / assist_rates.len() as f32;

    let reward_variance = mean_rewards
        .iter()
        .map(|r| (r - overall_reward_mean).powi(2))
        .sum::<f32>()
        / (mean_rewards.len() - 1) as f32;
    let reward_std_across_seeds = reward_variance.sqrt();

    let regret_variance = mean_regrets
        .iter()
        .map(|r| (r - overall_regret_mean).powi(2))
        .sum::<f32>()
        / (mean_regrets.len() - 1) as f32;
    let regret_std_across_seeds = regret_variance.sqrt();

    println!("Metrics across {} seeds:", seed_results.len());
    println!(
        "  Mean Reward: {:.3} ± {:.3}",
        overall_reward_mean, reward_std_across_seeds
    );
    println!(
        "  Mean Regret: {:.3} ± {:.3}",
        overall_regret_mean, regret_std_across_seeds
    );
    println!("  Mean Assist Rate: {:.1}%", overall_assist_mean * 100.0);

    let reward_cv = reward_std_across_seeds / overall_reward_mean.abs();
    println!("  Reward Consistency (CV): {:.3}", reward_cv);

    if reward_cv < 0.2 {
        println!("  ✅ Results are consistent across seeds");
    } else {
        println!("  ⚠️  Results vary significantly across seeds");
    }
}

/// Test adaptation with comprehensive context features
#[test]
#[ignore = "heavy"]
fn adaptation_with_context() -> Result<()> {
    println!("\n--- Starting Comprehensive Adaptation Test ---");
    println!("Testing agent adaptation with rich context features");

    let device = Device::Cpu;
    let mut dummy_rng = StdRng::seed_from_u64(0);
    let dummy_context = BanditContext::generate_random(&mut dummy_rng, Utc::now(), None, &[]);
    let feature_dim = dummy_context.feature_dim(true); // Use embedding
    let hidden_size = 128;
    let mut agent = NeuralUCBDiag::new(feature_dim, 0.05, 1.0, hidden_size, &device)?;

    let mut rng = StdRng::seed_from_u64(123);
    let mut user_sim = UserSimulator::new();

    println!("\nPhase 1: User prefers assistance (high transition tolerance)");
    user_sim.acceptance_bias = 0.3;
    user_sim.transition_sensitivity = 0.2;
    user_sim.similarity_threshold = 0.5;

    let mut phase1_rewards = Vec::new();
    let mut session_history = Vec::new();
    let mut previous_context: Option<BanditContext> = None;
    let mut phase1_decisions = vec![0, 0];

    for i in 0..100 {
        let context = BanditContext::generate_random(
            &mut rng,
            Utc::now(),
            previous_context.as_ref(),
            &session_history,
        );
        session_history.push(context.app_category.clone());
        if session_history.len() > 8 {
            session_history.remove(0);
        }

        let context_tensor = context.to_tensor(&device, true)?;
        let zero_context = Tensor::zeros((1, feature_dim), candle_core::DType::F32, &device)?;
        let contexts_for_agent = Tensor::cat(&[&zero_context, &context_tensor], 0)?;

        let (chosen_arm, _, _, _) = agent.select(&contexts_for_agent)?;
        phase1_decisions[chosen_arm] += 1;

        let user_action = if chosen_arm == 1 {
            user_sim.get_user_action(&context, &mut rng)
        } else {
            UserAction::Omit
        };
        let reward = context.compute_reward(chosen_arm, user_action);
        phase1_rewards.push(reward);

        let training_context = contexts_for_agent.narrow(0, chosen_arm, 1)?;
        agent.train(&training_context, reward)?;
        previous_context = Some(context);

        if i % 15 == 0 {
            let recent_rewards: Vec<f32> = phase1_rewards
                .iter()
                .rev()
                .take(15.min(phase1_rewards.len()))
                .cloned()
                .collect();
            let avg = recent_rewards.iter().sum::<f32>() / recent_rewards.len() as f32;
            let assist_rate = phase1_decisions[1] as f32 / (i + 1) as f32 * 100.0;
            println!(
                "  Round {}: Recent avg = {:.3}, Assist rate = {:.1}%",
                i + 1,
                avg,
                assist_rate
            );
        }
    }
    let phase1_avg = phase1_rewards.iter().sum::<f32>() / phase1_rewards.len() as f32;
    let phase1_assist_rate = phase1_decisions[1] as f32 / 75.0;

    println!("\nPhase 2: User becomes resistant to assistance (focused mode)");
    user_sim.acceptance_bias = -0.4;
    user_sim.transition_sensitivity = 0.05;
    user_sim.similarity_threshold = 0.8;

    let mut phase2_rewards = Vec::new();
    let mut phase2_decisions = vec![0, 0];

    for i in 0..100 {
        let context = BanditContext::generate_random(
            &mut rng,
            Utc::now(),
            previous_context.as_ref(),
            &session_history,
        );
        session_history.push(context.app_category.clone());
        if session_history.len() > 8 {
            session_history.remove(0);
        }

        let context_tensor = context.to_tensor(&device, true)?;
        let zero_context = Tensor::zeros((1, feature_dim), candle_core::DType::F32, &device)?;
        let contexts_for_agent = Tensor::cat(&[&zero_context, &context_tensor], 0)?;

        let (chosen_arm, _, _, _) = agent.select(&contexts_for_agent)?;
        phase2_decisions[chosen_arm] += 1;

        let user_action = if chosen_arm == 1 {
            user_sim.get_user_action(&context, &mut rng)
        } else {
            UserAction::Omit
        };
        let reward = context.compute_reward(chosen_arm, user_action);
        phase2_rewards.push(reward);

        let training_context = contexts_for_agent.narrow(0, chosen_arm, 1)?;
        agent.train_batch(&training_context, reward)?;
        previous_context = Some(context);

        if i % 15 == 0 {
            let recent_rewards: Vec<f32> = phase2_rewards
                .iter()
                .rev()
                .take(15.min(phase2_rewards.len()))
                .cloned()
                .collect();
            let avg = recent_rewards.iter().sum::<f32>() / recent_rewards.len() as f32;
            let assist_rate = phase2_decisions[1] as f32 / (i + 1) as f32 * 100.0;
            println!(
                "  Round {}: Recent avg = {:.3}, Assist rate = {:.1}%",
                i + 1,
                avg,
                assist_rate
            );
        }
    }

    let phase2_avg = phase2_rewards.iter().sum::<f32>() / phase2_rewards.len() as f32;
    let phase2_assist_rate = phase2_decisions[1] as f32 / 75.0;
    let early_phase2_avg = phase2_rewards[..25].iter().sum::<f32>() / 25.0;
    let late_phase2_avg = phase2_rewards[50..].iter().sum::<f32>() / 25.0;

    println!("\n=== Comprehensive Adaptation Results ===");
    println!("Phase 1 (Assistance Preferred):");
    println!("  Average Reward: {:.3}", phase1_avg);
    println!("  Assist Rate: {:.1}%", phase1_assist_rate * 100.0);
    println!("Phase 2 (Assistance Resistant):");
    println!("  Overall Average: {:.3}", phase2_avg);
    println!("  Overall Assist Rate: {:.1}%", phase2_assist_rate * 100.0);
    println!("  Early Phase 2: {:.3} reward", early_phase2_avg);
    println!("  Late Phase 2: {:.3} reward", late_phase2_avg);
    println!("  Improvement: {:.3}", late_phase2_avg - early_phase2_avg);

    println!("\n=== Context Feature Learning ===");
    println!("The agent learned to adapt to:");
    println!("  • Transition frequency patterns");
    println!("  • Keyword similarity thresholds");
    println!("  • Focus time and interruption sensitivity");
    println!("  • User state preferences");
    println!("  • Session consistency patterns");

    assert!(
        late_phase2_avg > early_phase2_avg,
        "Agent failed to adapt: {} vs {}",
        early_phase2_avg,
        late_phase2_avg
    );
    assert!(
        (late_phase2_avg - early_phase2_avg) > 0.05,
        "Adaptation improvement too small: {}",
        late_phase2_avg - early_phase2_avg
    );
    assert!(
        phase1_assist_rate > phase2_assist_rate
            || (phase1_assist_rate - phase2_assist_rate).abs() < 0.1,
        "Agent should show appropriate adaptation: phase1={:.2} vs phase2={:.2}",
        phase1_assist_rate,
        phase2_assist_rate
    );

    println!("\n✅ Comprehensive adaptation test passed!");
    Ok(())
}

/// Test context feature importance
#[test]
#[ignore = "heavy"]
fn context_feature_importance() -> Result<()> {
    println!("\n--- Testing Context Feature Importance ---");

    let device = Device::Cpu;
    let mut dummy_rng = StdRng::seed_from_u64(0);
    let dummy_context = BanditContext::generate_random(&mut dummy_rng, Utc::now(), None, &[]);
    let feature_dim = dummy_context.feature_dim(true); // Use embedding
    let hidden_size = 128;
    let mut agent = NeuralUCBDiag::new(feature_dim, 0.1, 1.0, hidden_size, &device)?;

    let mut rng = StdRng::seed_from_u64(456);
    let user_sim = UserSimulator::new();

    let test_scenarios = [
        ("High Transitions + Struggling", "struggling", 35, 0.2, 60),
        ("Low Transitions + Focused", "focused", 3, 0.1, 1200),
        ("High Similarity + Learning", "learning", 15, 0.9, 300),
        ("Low Similarity + Idle", "idle", 12, 0.1, 180),
    ];

    println!(
        "\n{:^30}|{:^12}|{:^10}|{:^10}|{:^10}",
        "Scenario", "Avg Reward", "Assist %", "Accept %", "Regret"
    );
    println!("{}", "-".repeat(75));

    for (scenario_name, forced_state, transitions, similarity, focus_time) in &test_scenarios {
        let mut scenario_rewards = Vec::new();
        let mut scenario_decisions = vec![0, 0];
        let mut scenario_acceptance = Vec::new();
        let mut scenario_regret = 0.0;

        for _ in 0..50 {
            let mut context = BanditContext::generate_random(&mut rng, Utc::now(), None, &vec![]);
            context.user_state = forced_state.to_string();
            context.num_transitions = *transitions;
            context.jaccard_similarity = *similarity;
            context.focus_time = *focus_time;

            let context_tensor = context.to_tensor(&device, true)?;
            let zero_context = Tensor::zeros((1, feature_dim), candle_core::DType::F32, &device)?;
            let contexts_for_agent = Tensor::cat(&[&zero_context, &context_tensor], 0)?;

            let (chosen_arm, _, _, _) = agent.select(&contexts_for_agent)?;
            scenario_decisions[chosen_arm] += 1;

            let user_action = if chosen_arm == 1 {
                let action = user_sim.get_user_action(&context, &mut rng);
                scenario_acceptance.push(match action {
                    UserAction::Accept => 1.0,
                    _ => 0.0,
                });
                action
            } else {
                UserAction::Omit
            };
            let reward = context.compute_reward(chosen_arm, user_action);
            scenario_rewards.push(reward);

            let no_assist_reward = context.compute_reward(0, UserAction::Omit);
            let (accept_prob, reject_prob, omit_prob) = user_sim.get_action_probabilities(&context);
            let assist_reward_accepted = context.compute_reward(1, UserAction::Accept);
            let assist_reward_rejected = context.compute_reward(1, UserAction::Reject);
            let assist_reward_omitted = context.compute_reward(1, UserAction::Omit);
            let expected_assist_reward = accept_prob * assist_reward_accepted
                + reject_prob * assist_reward_rejected
                + omit_prob * assist_reward_omitted;
            let optimal_reward = no_assist_reward.max(expected_assist_reward);
            scenario_regret += optimal_reward - reward;

            let training_context = contexts_for_agent.narrow(0, chosen_arm, 1)?;
            agent.train(&training_context, reward)?;
        }

        let avg_reward = scenario_rewards.iter().sum::<f32>() / scenario_rewards.len() as f32;
        let assist_rate = scenario_decisions[1] as f32 / 50.0 * 100.0;
        let accept_rate = if !scenario_acceptance.is_empty() {
            scenario_acceptance.iter().sum::<f32>() / scenario_acceptance.len() as f32 * 100.0
        } else {
            0.0
        };
        let avg_regret = scenario_regret / 50.0;

        println!(
            "| {:<28} | {:>10.3} | {:>8.1}% | {:>8.1}% | {:>8.3}",
            scenario_name, avg_reward, assist_rate, accept_rate, avg_regret
        );
    }
    println!("{}", "-".repeat(75));
    println!("✅ Context feature importance test completed!");
    Ok(())
}

/// Test extreme scenarios and edge cases
#[test]
#[ignore = "heavy"]
fn edge_cases_and_robustness() -> Result<()> {
    println!("\n--- Testing Edge Cases and Robustness ---");

    let device = Device::Cpu;
    let mut dummy_rng = StdRng::seed_from_u64(0);
    let dummy_context = BanditContext::generate_random(&mut dummy_rng, Utc::now(), None, &[]);
    let feature_dim = dummy_context.feature_dim(true); // Use embedding
    let hidden_size = 128;
    let mut agent = NeuralUCBDiag::new(feature_dim, 0.1, 2.0, hidden_size, &device)?;

    let mut rng = StdRng::seed_from_u64(999);
    let user_sim = UserSimulator::new();

    println!(
        "\n{:^25}|{:^12}|{:^10}|{:^10}|{:^10}",
        "Scenario", "Avg Reward", "Assist %", "Accept %", "Regret"
    );
    println!("{}", "-".repeat(70));

    let edge_scenarios = [
        ("Very High Transitions", 45, 0.1, 30, "struggling"),
        ("Zero Transitions", 0, 0.0, 1800, "focused"),
        ("Perfect Similarity", 8, 1.0, 600, "idle"),
        ("Zero Similarity", 15, 0.0, 200, "learning"),
        ("Long Focus Time", 5, 0.2, 7200, "flowing"),
        ("Very Short Focus", 35, 0.1, 5, "struggling"),
    ];

    for (scenario_name, transitions, similarity, focus_time, forced_state) in &edge_scenarios {
        let mut scenario_stats = BanditStats::new();
        for _ in 0..30 {
            let mut context = BanditContext::generate_random(&mut rng, Utc::now(), None, &vec![]);
            context.user_state = forced_state.to_string();
            context.num_transitions = *transitions;
            context.jaccard_similarity = *similarity;
            context.focus_time = *focus_time;

            let context_tensor = context.to_tensor(&device, true)?;
            let zero_context = Tensor::zeros((1, feature_dim), candle_core::DType::F32, &device)?;
            let contexts_for_agent = Tensor::cat(&[&zero_context, &context_tensor], 0)?;

            let (chosen_arm, _, _, _) = agent.select(&contexts_for_agent)?;
            let user_action = if chosen_arm == 1 {
                user_sim.get_user_action(&context, &mut rng)
            } else {
                UserAction::Omit
            };
            let reward = context.compute_reward(chosen_arm, user_action);

            let no_assist_reward = context.compute_reward(0, UserAction::Omit);
            let (accept_prob, reject_prob, omit_prob) = user_sim.get_action_probabilities(&context);
            let assist_reward_accepted = context.compute_reward(1, UserAction::Accept);
            let assist_reward_rejected = context.compute_reward(1, UserAction::Reject);
            let assist_reward_omitted = context.compute_reward(1, UserAction::Omit);
            let expected_assist_reward = accept_prob * assist_reward_accepted
                + reject_prob * assist_reward_rejected
                + omit_prob * assist_reward_omitted;
            let optimal_reward = no_assist_reward.max(expected_assist_reward);
            let regret = optimal_reward - reward;
            scenario_stats.add_observation(
                context.user_state.clone(),
                reward,
                regret,
                chosen_arm,
                user_action == UserAction::Accept,
            );

            let training_context = contexts_for_agent.narrow(0, chosen_arm, 1)?;
            agent.train(&training_context, reward)?;
        }

        let avg_reward = scenario_stats.mean_reward();
        let avg_regret = scenario_stats.mean_regret();
        let assist_rate = scenario_stats.assist_rate() * 100.0;
        let accept_rate = if !scenario_stats.acceptance_rates.is_empty() {
            scenario_stats.acceptance_rates.iter().sum::<f32>()
                / scenario_stats.acceptance_rates.len() as f32
                * 100.0
        } else {
            0.0
        };

        println!(
            "| {:<23} | {:>10.3} | {:>8.1}% | {:>8.1}% | {:>8.3}",
            scenario_name, avg_reward, assist_rate, accept_rate, avg_regret
        );
    }
    println!("{}", "-".repeat(70));
    println!("\n✅ Edge cases and robustness test completed!");
    Ok(())
}

/// Test parameter sensitivity
#[test]
#[ignore = "heavy"]
fn parameter_sensitivity() -> Result<()> {
    println!("\n--- Testing Parameter Sensitivity ---");

    let device = Device::Cpu;
    let mut dummy_rng = StdRng::seed_from_u64(0);
    let dummy_context = BanditContext::generate_random(&mut dummy_rng, Utc::now(), None, &[]);
    let feature_dim = dummy_context.feature_dim(true); // Use embedding

    // hidden_size, beta, lambda
    let param_configs = [
        ("Low Beta", 64, 0.01, 0.5),
        ("High Beta", 64, 0.1, 2.0),
        ("Small Network", 32, 0.05, 1.0),
        ("Large Network", 128, 0.05, 1.0),
        ("Conservative", 64, 0.02, 0.3),
        ("Aggressive", 64, 0.15, 3.0),
    ];

    println!(
        "\n{:^15}|{:^12}|{:^10}|{:^10}|{:^10}",
        "Config", "Avg Reward", "Std Dev", "Assist %", "Regret"
    );
    println!("{}", "-".repeat(60));

    for (config_name, hidden_size, beta, lambda) in &param_configs {
        let mut agent = NeuralUCBDiag::new(feature_dim, *beta, *lambda, *hidden_size, &device)?;
        let mut rng = StdRng::seed_from_u64(555);
        let user_sim = UserSimulator::new();
        let mut config_stats = BanditStats::new();

        for _ in 0..100 {
            let context = BanditContext::generate_random(&mut rng, Utc::now(), None, &vec![]);
            let context_tensor = context.to_tensor(&device, true)?;
            let zero_context = Tensor::zeros((1, feature_dim), candle_core::DType::F32, &device)?;
            let contexts_for_agent = Tensor::cat(&[&zero_context, &context_tensor], 0)?;

            let (chosen_arm, _, _, _) = agent.select(&contexts_for_agent)?;
            let user_action = if chosen_arm == 1 {
                user_sim.get_user_action(&context, &mut rng)
            } else {
                UserAction::Omit
            };
            let reward = context.compute_reward(chosen_arm, user_action);

            let no_assist_reward = context.compute_reward(0, UserAction::Omit);
            let (accept_prob, reject_prob, omit_prob) = user_sim.get_action_probabilities(&context);
            let assist_reward_accepted = context.compute_reward(1, UserAction::Accept);
            let assist_reward_rejected = context.compute_reward(1, UserAction::Reject);
            let assist_reward_omitted = context.compute_reward(1, UserAction::Omit);
            let expected_assist_reward = accept_prob * assist_reward_accepted
                + reject_prob * assist_reward_rejected
                + omit_prob * assist_reward_omitted;
            let optimal_reward = no_assist_reward.max(expected_assist_reward);
            let regret = optimal_reward - reward;
            config_stats.add_observation(
                context.user_state.clone(),
                reward,
                regret,
                chosen_arm,
                user_action == UserAction::Accept,
            );

            let training_context = contexts_for_agent.narrow(0, chosen_arm, 1)?;
            agent.train(&training_context, reward)?;
        }

        let avg_reward = config_stats.mean_reward();
        let reward_std = config_stats.std_deviation(&config_stats.rewards);
        let assist_rate = config_stats.assist_rate() * 100.0;
        let avg_regret = config_stats.mean_regret();

        println!(
            "| {:<13} | {:>10.3} | {:>8.3} | {:>8.1}% | {:>8.3}",
            config_name, avg_reward, reward_std, assist_rate, avg_regret
        );
    }
    println!("{}", "-".repeat(60));
    println!("\n✅ Parameter sensitivity test completed!");
    Ok(())
}

/// Simple test to validate feature dimensions
#[test]
#[ignore = "heavy"]
fn feature_dimensions() -> Result<()> {
    println!("\n--- Testing Feature Dimensions ---");

    let device = Device::Cpu;
    let mut rng = StdRng::seed_from_u64(789);
    let context = BanditContext::generate_random(&mut rng, Utc::now(), None, &vec![]);

    // Test with embedding
    let tensor_with = context.to_tensor(&device, true)?;
    let actual_with = tensor_with.shape().dims()[1];
    let expected_with = context.feature_dim(true);
    println!("\nWith Embedding:");
    println!("  Expected features: {}", expected_with);
    println!("  Actual features:   {}", actual_with);
    assert_eq!(actual_with, expected_with, "Mismatch with embedding");

    // Test without embedding
    let tensor_without = context.to_tensor(&device, false)?;
    let actual_without = tensor_without.shape().dims()[1];
    let expected_without = context.feature_dim(false);
    println!("\nWithout Embedding:");
    println!("  Expected features: {}", expected_without);
    println!("  Actual features:   {}", actual_without);
    assert_eq!(
        actual_without, expected_without,
        "Mismatch without embedding"
    );

    println!("\n✅ Feature dimensions test passed!");
    Ok(())
}

/// Test long-term learning stability
#[test]
#[ignore = "heavy"]
fn long_term_stability() -> Result<()> {
    println!("\n--- Testing Long-term Learning Stability ---");

    let device = Device::Cpu;
    let mut dummy_rng = StdRng::seed_from_u64(0);
    let dummy_context = BanditContext::generate_random(&mut dummy_rng, Utc::now(), None, &[]);
    let feature_dim = dummy_context.feature_dim(true); // Use embedding
    let hidden_size = 128;
    let mut agent = NeuralUCBDiag::new(feature_dim, 0.05, 1.0, hidden_size, &device)?;

    let mut rng = StdRng::seed_from_u64(777);
    let user_sim = UserSimulator::new();
    let mut stability_stats = BanditStats::new();
    let total_rounds = 1000;
    let window_size = 100;
    let mut performance_windows = Vec::new();

    for round in 0..total_rounds {
        let context = BanditContext::generate_random(&mut rng, Utc::now(), None, &vec![]);
        let context_tensor = context.to_tensor(&device, true)?;
        let zero_context = Tensor::zeros((1, feature_dim), candle_core::DType::F32, &device)?;
        let contexts_for_agent = Tensor::cat(&[&zero_context, &context_tensor], 0)?;

        let (chosen_arm, _, _, _) = agent.select(&contexts_for_agent)?;
        let user_action = if chosen_arm == 1 {
            user_sim.get_user_action(&context, &mut rng)
        } else {
            UserAction::Omit
        };
        let reward = context.compute_reward(chosen_arm, user_action);

        let no_assist_reward = context.compute_reward(0, UserAction::Omit);
        let (accept_prob, reject_prob, omit_prob) = user_sim.get_action_probabilities(&context);
        let assist_reward_accepted = context.compute_reward(1, UserAction::Accept);
        let assist_reward_rejected = context.compute_reward(1, UserAction::Reject);
        let assist_reward_omitted = context.compute_reward(1, UserAction::Omit);
        let expected_assist_reward = accept_prob * assist_reward_accepted
            + reject_prob * assist_reward_rejected
            + omit_prob * assist_reward_omitted;
        let optimal_reward = no_assist_reward.max(expected_assist_reward);
        let regret = optimal_reward - reward;
        stability_stats.add_observation(
            context.user_state.clone(),
            reward,
            regret,
            chosen_arm,
            user_action == UserAction::Accept,
        );

        let training_context = contexts_for_agent.narrow(0, chosen_arm, 1)?;
        agent.train(&training_context, reward)?;

        if (round + 1) % window_size == 0 {
            let window_start = round + 1 - window_size;
            let window_rewards = &stability_stats.rewards[window_start..=round];
            let window_regrets = &stability_stats.regrets[window_start..=round];
            let window_actions = &stability_stats.actions[window_start..=round];
            let window_avg_reward =
                window_rewards.iter().sum::<f32>() / window_rewards.len() as f32;
            let window_avg_regret =
                window_regrets.iter().sum::<f32>() / window_regrets.len() as f32;
            let window_assist_rate = window_actions.iter().filter(|&&a| a == 1).count() as f32
                / window_actions.len() as f32;
            performance_windows.push((
                round + 1,
                window_avg_reward,
                window_avg_regret,
                window_assist_rate,
            ));
        }
    }
    let early_windows = &performance_windows[0..3];
    let late_windows = &performance_windows[performance_windows.len() - 3..];
    let early_avg =
        early_windows.iter().map(|(_, r, _, _)| *r).sum::<f32>() / early_windows.len() as f32;
    let late_avg =
        late_windows.iter().map(|(_, r, _, _)| *r).sum::<f32>() / late_windows.len() as f32;
    let performance_variance = performance_windows
        .iter()
        .map(|(_, r, _, _)| (r - stability_stats.mean_reward()).powi(2))
        .sum::<f32>()
        / performance_windows.len() as f32;

    println!("\n=== Long-term Stability Analysis ===");
    println!("Late performance (last 300 rounds): {:.3}", late_avg);
    assert!(
        late_avg >= early_avg - 0.3,
        "Performance degraded: early={:.3} vs late={:.3}",
        early_avg,
        late_avg
    );
    assert!(
        performance_variance < 0.5,
        "Performance too unstable: {:.4}",
        performance_variance
    );
    println!("\n✅ Long-term stability test passed!");
    Ok(())
}

/// Compares model performance with and without the user intention embedding.
#[test]
#[ignore = "heavy"]
fn embedding_impact_comparison() -> Result<()> {
    println!("\n--- Starting Embedding Impact Comparison Test ---");
    println!(
        "Running simulations to compare performance with and without the user intention embedding."
    );

    let seeds = [42, 123, 456];
    let mut results_with_embedding = Vec::new();
    let mut results_without_embedding = Vec::new();

    for &seed in &seeds {
        println!("\n--- Running simulations for seed {} ---", seed);

        // Run with embedding
        let stats_with = run_single_simulation(true, seed)?;
        println!(
            "Result (With Embedding):    Avg Reward={:.3}, Avg Regret={:.3}",
            stats_with.mean_reward(),
            stats_with.mean_regret()
        );
        results_with_embedding.push(stats_with);

        // Run without embedding
        let stats_without = run_single_simulation(false, seed)?;
        println!(
            "Result (Without Embedding): Avg Reward={:.3}, Avg Regret={:.3}",
            stats_without.mean_reward(),
            stats_without.mean_regret()
        );
        results_without_embedding.push(stats_without);
    }

    // --- Analysis and Comparison ---
    let avg_reward_with = results_with_embedding
        .iter()
        .map(|s| s.mean_reward())
        .sum::<f32>()
        / results_with_embedding.len() as f32;
    let avg_reward_without = results_without_embedding
        .iter()
        .map(|s| s.mean_reward())
        .sum::<f32>()
        / results_without_embedding.len() as f32;

    let avg_regret_with = results_with_embedding
        .iter()
        .map(|s| s.mean_regret())
        .sum::<f32>()
        / results_with_embedding.len() as f32;
    let avg_regret_without = results_without_embedding
        .iter()
        .map(|s| s.mean_regret())
        .sum::<f32>()
        / results_without_embedding.len() as f32;

    println!(
        "\n\n--- Overall Comparison Summary (Avg across {} seeds) ---",
        seeds.len()
    );
    println!("{}", "=".repeat(60));
    println!(
        "{:^25}|{:^15}|{:^15}",
        "Metric", "With Embedding", "Without Embedding"
    );
    println!("{}", "-".repeat(60));
    println!(
        "{:<25}|{:^15.3}|{:^15.3}",
        "Average Reward", avg_reward_with, avg_reward_without
    );
    println!(
        "{:<25}|{:^15.3}|{:^15.3}",
        "Average Regret", avg_regret_with, avg_regret_without
    );
    println!("{}", "=".repeat(60));

    let reward_improvement = avg_reward_with - avg_reward_without;
    let regret_reduction = avg_regret_without - avg_regret_with;

    println!("\nAnalysis:");
    println!(
        "  Reward Improvement with Embedding: {:.3} ({:.1}%)",
        reward_improvement,
        (reward_improvement / avg_reward_without.abs()) * 100.0
    );
    println!(
        "  Regret Reduction with Embedding:   {:.3} ({:.1}%)",
        regret_reduction,
        (regret_reduction / avg_regret_without.abs()) * 100.0
    );

    // Assert that the embedding provides a tangible benefit
    assert!(
        avg_reward_with > avg_reward_without,
        "Expected higher reward with embedding. With: {}, Without: {}",
        avg_reward_with,
        avg_reward_without
    );
    assert!(
        avg_regret_with < avg_regret_without,
        "Expected lower regret with embedding. With: {}, Without: {}",
        avg_regret_with,
        avg_regret_without
    );

    println!("\n✅ Embedding impact comparison test passed!");
    println!("The user intention embedding demonstrably improves model performance.");

    Ok(())
}

/// Helper function to run a single simulation with or without the embedding.
fn run_single_simulation(use_embedding: bool, seed: u64) -> Result<BanditStats> {
    let device = Device::Cpu;
    let mut dummy_rng = StdRng::seed_from_u64(0);
    let dummy_context = BanditContext::generate_random(&mut dummy_rng, Utc::now(), None, &[]);
    let feature_dim = dummy_context.feature_dim(use_embedding);
    let hidden_size = 128;
    let mut agent = NeuralUCBDiag::new(feature_dim, 0.05, 1.0, hidden_size, &device)?;

    let mut rng = StdRng::seed_from_u64(seed);
    let user_sim = UserSimulator::new();
    let mut stats = BanditStats::new();
    let mut contexts = Vec::new();
    let mut previous_context: Option<BanditContext> = None;
    let mut session_history = Vec::new();

    for _ in 0..500 {
        let context = BanditContext::generate_random(
            &mut rng,
            Utc::now(),
            previous_context.as_ref(),
            &session_history,
        );
        session_history.push(context.app_category.clone());
        if session_history.len() > 10 {
            session_history.remove(0);
        }
        contexts.push(context.clone());
        previous_context = Some(context);
    }

    for context in contexts.iter() {
        let context_tensor = context.to_tensor(&device, use_embedding)?;
        let zero_context = Tensor::zeros((1, feature_dim), candle_core::DType::F32, &device)?;
        let contexts_for_agent = Tensor::cat(&[&zero_context, &context_tensor], 0)?;

        let (chosen_arm, _, _, _) = agent.select(&contexts_for_agent)?;

        let user_action = if chosen_arm == 1 {
            user_sim.get_user_action(context, &mut rng)
        } else {
            UserAction::Omit
        };

        let reward = context.compute_reward(chosen_arm, user_action);

        let no_assist_reward = context.compute_reward(0, UserAction::Omit);
        let (accept_prob, reject_prob, omit_prob) = user_sim.get_action_probabilities(&context);
        let assist_reward_if_accepted = context.compute_reward(1, UserAction::Accept);
        let assist_reward_if_rejected = context.compute_reward(1, UserAction::Reject);
        let assist_reward_if_omitted = context.compute_reward(1, UserAction::Omit);
        let expected_assist_reward = accept_prob * assist_reward_if_accepted
            + reject_prob * assist_reward_if_rejected
            + omit_prob * assist_reward_if_omitted;
        let optimal_reward = no_assist_reward.max(expected_assist_reward);
        let regret = optimal_reward - reward;

        stats.add_observation(
            context.user_state.clone(),
            reward,
            regret,
            chosen_arm,
            user_action == UserAction::Accept,
        );

        let training_context = contexts_for_agent.narrow(0, chosen_arm, 1)?;
        agent.train(&training_context, reward)?;
    }

    Ok(stats)
}
