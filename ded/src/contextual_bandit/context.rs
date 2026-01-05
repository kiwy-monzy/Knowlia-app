use std::fmt;

use crate::constants;
use anyhow::Result;
use candle_core::{Device, Tensor};

/// Possible user actions in response to assistance
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum UserAction {
    Accept,
    Reject,
    Omit,
}

impl fmt::Display for UserAction {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            UserAction::Accept => write!(f, "accept"),
            UserAction::Reject => write!(f, "reject"),
            UserAction::Omit => write!(f, "omit"),
        }
    }
}

/// Represents synthetic context data similar to what would be stored in the database
#[derive(Clone)]
pub struct BanditContext {
    // User state from intention analysis
    pub user_state: String,
    // Current app category
    pub app_category: String,
    // Current app focus time in seconds
    pub focus_time: i64,
    // Total focus time for current app in seconds
    pub total_focus_time: i64,
    // Time since last app transition in seconds
    pub duration_since_last: i64,
    // Number of app transitions in the last hour
    pub num_transitions: u32,
    // Most frequent app category in recent session
    pub most_frequent_category: String,
    // Jaccard similarity with previous user keywords (0.0-1.0)
    pub jaccard_similarity: f32,
    // Window-specific keywords from LLM description of screenshot
    pub window_keywords: Vec<String>,
    // User-level keywords from intention analysis
    pub user_keywords: Vec<String>,
    // User intention embedding (384-dimensional)
    pub user_intention_embedding: Vec<f32>,
    // Time of day (0-23)
    pub hour_of_day: u32,
    // Day of week (0-6)
    pub day_of_week: u32,
    // Last user intention string
    pub last_user_intention_str: String,
    // App description string
    pub app_description_str: String,
}

impl BanditContext {
    /// Convert to tensor representation, optionally including the user intention embedding.
    pub fn to_tensor(&self, device: &Device, use_embedding: bool) -> Result<Tensor> {
        let mut features = Vec::new();

        // Encode user state as one-hot (7 features)
        features.extend(&Self::one_hot_encode(
            &self.user_state,
            constants::USER_STATES,
        ));
        // Encode app category as one-hot (17 features)
        features.extend(&Self::one_hot_encode(
            &self.app_category,
            constants::WINDOW_LABELS,
        ));
        // Encode most frequent category as one-hot (17 features)
        features.extend(&Self::one_hot_encode(
            &self.most_frequent_category,
            constants::WINDOW_LABELS,
        ));

        // Normalized time-based and count features (7 features)
        features.push(Self::normalize_log(self.focus_time as u32, 10.0));
        features.push(Self::normalize_log(self.total_focus_time as u32, 15.0));
        features.push(Self::normalize_log(self.duration_since_last as u32, 8.0));
        features.push(Self::normalize_linear(self.num_transitions as usize, 50.0));
        features.push(self.jaccard_similarity);
        features.push(Self::normalize_linear(self.window_keywords.len(), 10.0));
        features.push(Self::normalize_linear(self.user_keywords.len(), 10.0));

        // Time and context features (4 features)
        features.push(self.hour_of_day as f32 / 24.0);
        features.push(self.day_of_week as f32 / 7.0);
        features.push(if self.app_category == self.most_frequent_category {
            1.0
        } else {
            0.0
        });
        features.push(if self.hour_of_day >= 9 && self.hour_of_day <= 17 {
            1.0
        } else {
            0.0
        });

        // Conditionally add user intention embedding (384 dimensions)
        if use_embedding {
            features.extend(&self.user_intention_embedding);
        }

        Ok(Tensor::from_vec(
            features,
            (1, self.feature_dim(use_embedding)),
            device,
        )?)
    }

    pub fn compute_reward(&self, action: usize, user_action: UserAction) -> f32 {
        const NO_ASSIST: usize = 0;
        const ASSIST: usize = 1;

        match action {
            NO_ASSIST => {
                // Base reward for not assisting
                let base_reward = match self.user_state.as_str() {
                    "flowing" | "focused" => 1.0,
                    "struggling" => -1.0,
                    "idle" => -0.3,
                    _ => 0.0,
                };

                // Penalty for not helping when there are many transitions (struggling behavior)
                let transition_penalty = if self.num_transitions > 25 { -0.3 } else { 0.0 };

                base_reward + transition_penalty
            }
            ASSIST => {
                match user_action {
                    UserAction::Accept => {
                        let base_reward = match self.user_state.as_str() {
                            "struggling" => 1.0,
                            "idle" => 0.7,
                            "learning" => 0.6,
                            "focused" | "flowing" => 0.3,
                            _ => 0.1,
                        };

                        // Bonus for helping when there are many transitions
                        let transition_bonus = if self.num_transitions > 20 { 0.2 } else { 0.0 };

                        // Penalty for repetitive assistance (high similarity)
                        let similarity_penalty = if self.jaccard_similarity > 0.8 {
                            -0.2
                        } else {
                            0.0
                        };

                        base_reward + transition_bonus + similarity_penalty
                    }
                    UserAction::Reject => {
                        // Assistance was offered but rejected
                        let base_penalty = match self.user_state.as_str() {
                            "flowing" | "focused" => -1.0,
                            "struggling" => -0.2,
                            _ => -0.5,
                        };

                        base_penalty
                    }
                    UserAction::Omit => {
                        // Assistance was offered but user ignored it
                        // This is less negative than rejection but still indicates poor timing
                        let base_penalty = match self.user_state.as_str() {
                            "flowing" | "focused" => -0.5,
                            "struggling" => -0.1,
                            _ => -0.3,
                        };

                        // Less penalty for omitting when similarity is high (repetitive context)
                        let similarity_adjustment = if self.jaccard_similarity > 0.8 {
                            0.1
                        } else {
                            0.0
                        };

                        base_penalty + similarity_adjustment
                    }
                }
            }
            _ => 0.0,
        }
    }

    /// Get the dimension of the feature vector, configurable with/without embedding.
    pub fn feature_dim(&self, use_embedding: bool) -> usize {
        let base_dim = constants::USER_STATES.len()   // user_state one-hot
            + constants::WINDOW_LABELS.len() // app_category one-hot
            + constants::WINDOW_LABELS.len() // most_frequent_category one-hot
            + 7  // normalized time/count features
            + 4; // time and context features

        if use_embedding {
            base_dim + constants::EMBEDDING_SIZE
        } else {
            base_dim
        }
    }

    /// Log normalization with max clamp
    pub fn normalize_log(value: u32, divisor: f32) -> f32 {
        ((value as f32 + 1.0).ln() / divisor).min(1.0)
    }

    /// Linear normalization with max clamp
    pub fn normalize_linear(value: usize, divisor: f32) -> f32 {
        (value as f32 / divisor).min(1.0)
    }

    /// One-hot encoding of a string value
    pub fn one_hot_encode(value: &str, vocab: &[&str]) -> Vec<f32> {
        let mut encoding = vec![0.0; vocab.len()];
        if let Some(idx) = vocab.iter().position(|&v| v == value) {
            encoding[idx] = 1.0;
        }
        encoding
    }
}
