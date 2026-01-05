use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    pub role: String,
    pub content: Vec<Content>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

impl Message {
    pub fn system(content: impl ToString) -> Self {
        Self {
            role: "system".to_string(),
            content: vec![Content {
                content_type: "text".to_string(),
                text: Some(content.to_string()),
                image_url: None,
            }],
            tool_calls: None,
            tool_call_id: None,
        }
    }

    pub fn user(content: impl ToString, image_url: Option<String>) -> Self {
        let mut content_vec: Vec<Content> = vec![Content {
            content_type: "text".to_string(),
            text: Some(content.to_string()),
            image_url: None,
        }];

        if let Some(image_url) = image_url {
            content_vec.push(Content {
                content_type: "image_url".to_string(),
                text: None,
                image_url: Some(ImageUrl { url: image_url }),
            });
        }

        Self {
            role: "user".to_string(),
            content: content_vec,
            tool_calls: None,
            tool_call_id: None,
        }
    }

    pub fn assistant(content: impl ToString, tool_calls: Option<Vec<ToolCall>>) -> Self {
        Self {
            role: "assistant".to_string(),
            content: vec![Content {
                content_type: "text".to_string(),
                text: Some(content.to_string()),
                image_url: None,
            }],
            tool_calls,
            tool_call_id: None,
        }
    }

    pub fn tool(content: impl ToString, tool_call_id: String) -> Self {
        Self {
            role: "tool".to_string(),
            content: vec![Content {
                content_type: "text".to_string(),
                text: Some(content.to_string()),
                image_url: None,
            }],
            tool_calls: None,
            tool_call_id: Some(tool_call_id),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Content {
    #[serde(rename = "type")]
    pub content_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_url: Option<ImageUrl>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImageUrl {
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CompletionRequest {
    pub stream: bool,
    pub temperature: f32,
    pub model: String,
    pub messages: Vec<Message>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<Tool>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Function {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Tool {
    #[serde(rename = "type")]
    pub _type: String,
    pub function: Function,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolCall {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(rename = "type")]
    pub _type: String,
    pub function: ToolFunction,
}
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolFunction {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub arguments: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ToolResult {
    pub success: bool,
    pub contents: Vec<Content>,
}

#[derive(Serialize, Deserialize)]
pub struct ApiResponse {
    pub choices: Vec<Choice>,
}

#[derive(Serialize, Deserialize)]
pub struct Choice {
    pub message: ResponseMessage,
}

#[derive(Debug, Clone, Deserialize)]
pub struct StreamChunk {
    pub choices: Vec<StreamChoice>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct StreamChoice {
    pub delta: StreamDelta,
    pub finish_reason: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct StreamDelta {
    pub content: Option<String>,
    pub tool_calls: Option<Vec<ToolCall>>,
    pub reasoning_details: Option<Vec<ReasoningDetail>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReasoningDetail {
    #[serde(rename = "type")]
    pub reasoning_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    pub signature: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub format: String,
    pub index: u32,
}

#[derive(Serialize, Deserialize)]
pub struct ResponseMessage {
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
}
