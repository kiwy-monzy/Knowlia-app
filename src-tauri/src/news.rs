use reqwest::Client;
use scraper::{Html, Selector};
use serde::Serialize;
use tauri::command;

// Function to strip HTML tags from a string
fn strip_html_tags(html: &str) -> String {
    let mut result = String::new();
    let mut in_tag = false;
    for c in html.chars() {
        match c {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => result.push(c),
            _ => {}
        }
    }
    result
}

#[derive(Serialize)]
pub struct NewsArticle {
    title: String,
    url: String,
    image: String,
    date: String,
    category: String,
    summary: String,
}

#[derive(Serialize)]
pub struct NewsArticleDetail {
    title: String,
    url: String,
    image: String,
    date: String,
    category: String,
    content: String,
    author: String,
}

#[derive(Serialize)]
pub struct ScrapeResult {
    articles: Vec<NewsArticle>,
}

#[command]
pub async fn scrape_udsm_news() -> Result<ScrapeResult, String> {
    // Initialize HTTP client
    let client = Client::new();

    // Fetch the webpage
    let response = client
        .get("https://udsm.ac.tz/news")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch webpage: {}", e))?;

    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    // Parse HTML
    let document = Html::parse_document(&body);

    // Selectors for news articles
    let post_block_selector = Selector::parse(".post-block")
        .map_err(|_| "Failed to parse post-block selector".to_string())?;
    let title_selector = Selector::parse(".post-title a span")
        .map_err(|_| "Failed to parse title selector".to_string())?;
    let url_selector =
        Selector::parse(".post-title a").map_err(|_| "Failed to parse URL selector".to_string())?;
    let image_selector = Selector::parse(".post-image img")
        .map_err(|_| "Failed to parse image selector".to_string())?;
    let date_selector = Selector::parse(".post-created")
        .map_err(|_| "Failed to parse date selector".to_string())?;
    let category_selector = Selector::parse(".post-categories a")
        .map_err(|_| "Failed to parse category selector".to_string())?;
    let summary_selector = Selector::parse(".post-body .field__item")
        .map_err(|_| "Failed to parse summary selector".to_string())?;

    let mut articles = Vec::new();

    // Iterate over each post block
    for post_block in document.select(&post_block_selector) {
        let title = post_block
            .select(&title_selector)
            .next()
            .map(|element| element.inner_html().trim().to_string())
            .unwrap_or_default();

        let url = post_block
            .select(&url_selector)
            .next()
            .and_then(|element| element.value().attr("href"))
            .map(|href| format!("https://udsm.ac.tz{}", href))
            .unwrap_or_default();

        let image = post_block
            .select(&image_selector)
            .next()
            .and_then(|element| element.value().attr("src"))
            .map(|src| format!("https://udsm.ac.tz{}", src))
            .unwrap_or_default();

        let date = post_block
            .select(&date_selector)
            .next()
            .map(|element| element.inner_html().trim().to_string())
            .unwrap_or_default();

        let category = post_block
            .select(&category_selector)
            .next()
            .map(|element| element.inner_html().trim().to_string())
            .unwrap_or_default();

        let summary = post_block
            .select(&summary_selector)
            .next()
            .map(|element| strip_html_tags(&element.inner_html().trim()).to_string())
            .unwrap_or_default();

        if !title.is_empty() {
            articles.push(NewsArticle {
                title,
                url,
                image,
                date,
                category,
                summary,
            });
        }
    }

    Ok(ScrapeResult { articles })
}

#[command]
pub async fn scrape_article_content(url: String) -> Result<NewsArticleDetail, String> {
    // Initialize HTTP client
    let client = Client::new();

    // Fetch the article webpage
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch article webpage: {}", e))?;

    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    // Parse HTML
    let document = Html::parse_document(&body);

    // Selectors for article detail page
    let title_selector = Selector::parse(".post-title span")
        .map_err(|_| "Failed to parse title selector".to_string())?;
    let image_selector = Selector::parse(".post-thumbnail img")
        .map_err(|_| "Failed to parse image selector".to_string())?;
    let date_selector = Selector::parse(".post-created")
        .map_err(|_| "Failed to parse date selector".to_string())?;
    let category_selector = Selector::parse(".post-categories a")
        .map_err(|_| "Failed to parse category selector".to_string())?;
    let content_selector = Selector::parse(".node__content .field__item")
        .map_err(|_| "Failed to parse content selector".to_string())?;
    let author_selector = Selector::parse(".node__content .field__item a")
        .map_err(|_| "Failed to parse author selector".to_string())?;

    // Extract article details
    let title = document
        .select(&title_selector)
        .next()
        .map(|element| element.inner_html().trim().to_string())
        .unwrap_or_default();

    let image = document
        .select(&image_selector)
        .next()
        .and_then(|element| element.value().attr("src"))
        .map(|src| {
            if src.starts_with("https") {
                src.to_string()
            } else {
                format!("https://udsm.ac.tz{}", src)
            }
        })
        .unwrap_or_default();

    let date = document
        .select(&date_selector)
        .next()
        .map(|element| element.inner_html().trim().to_string())
        .unwrap_or_default();

    let category = document
        .select(&category_selector)
        .next()
        .map(|element| element.inner_html().trim().to_string())
        .unwrap_or_default();

    // The content is expected to be HTML for dangerouslySetInnerHTML, so we don't strip it.
    let content = document
        .select(&content_selector)
        .next()
        .map(|element| element.inner_html().trim().to_string())
        .unwrap_or_default();

    let author = document
        .select(&author_selector)
        .next()
        .map(|element| element.inner_html().trim().to_string())
        .unwrap_or_default();

    Ok(NewsArticleDetail {
        title,
        url,
        image,
        date,
        category,
        content,
        author,
    })
}
