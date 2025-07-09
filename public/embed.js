(function () {
  const DEBUG = true; // Enable debugging to see what's happening
  const log = (...args) => DEBUG && console.log("[RAG-OPT]", ...args);

  // RAG-specific chunking configuration
  const CHUNK_CONFIG = {
    targetTokens: 384,
    overlapTokens: 64,
    minChunkSize: 256,
    maxChunkSize: 512
  };

  function getISOTimestamp() {
    return new Date().toISOString();
  }

  function getArticleContainer() {
    const selectors = [
      '[data-rag-article]',
      'main article',
      '[role="main"] article',
      '.entry-content',
      '.post-content',
      '.article-content',
      '.content-body',
      '[itemtype*="Article"]',
      'article',
      'main',
      '[role="main"]'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length > 500) {
        log(`Found article container using selector: ${sel}`);
        return el;
      }
    }

    // More aggressive fallback - find the largest text container
    const candidates = Array.from(document.querySelectorAll('div')).filter(div => {
      const text = div.textContent.trim();
      return text.length > 500 && div.querySelectorAll('p').length > 3;
    });

    if (candidates.length > 0) {
      const largest = candidates.reduce((prev, current) => 
        prev.textContent.length > current.textContent.length ? prev : current
      );
      log(`Found article container via largest text div: ${largest.className || largest.id || 'unnamed'}`);
      return largest;
    }

    log("No specific container found. Falling back to <body>.");
    return document.body;
  }

  // Estimate token count (rough approximation)
  function estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  // Create semantic chunks optimized for RAG retrieval
  function createSemanticChunks(content) {
    if (!content || content.length < 100) {
      log("Content too short for chunking");
      return [];
    }

    const chunks = [];
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 50);
    let currentChunk = '';
    let currentTokens = 0;

    log(`Processing ${paragraphs.length} paragraphs for chunking`);

    for (const paragraph of paragraphs) {
      const paraTokens = estimateTokens(paragraph);
      
      if (currentTokens + paraTokens > CHUNK_CONFIG.targetTokens && currentChunk) {
        // Add chunk with citation metadata
        chunks.push({
          text: currentChunk.trim(),
          tokens: currentTokens,
          chunkId: `chunk_${chunks.length}`,
          entities: extractEntities(currentChunk),
          claims: extractClaims(currentChunk),
          citationReady: true
        });

        // Start new chunk with overlap
        const sentences = currentChunk.split(/[.!?]+/).filter(s => s.trim());
        const overlapSentences = sentences.slice(-2); // Last 2 sentences for context
        currentChunk = overlapSentences.join('. ') + '. ' + paragraph;
        currentTokens = estimateTokens(currentChunk);
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        currentTokens += paraTokens;
      }
    }

    // Add final chunk
    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        tokens: currentTokens,
        chunkId: `chunk_${chunks.length}`,
        entities: extractEntities(currentChunk),
        claims: extractClaims(currentChunk),
        citationReady: true
      });
    }

    log(`Created ${chunks.length} semantic chunks`);
    return chunks;
  }

  // Extract entities for better LLM understanding
  function extractEntities(text) {
    const entities = [];
    
    // Extract numbers and percentages (key for citations)
    const numberPattern = /\b\d{1,3}(?:,\d{3})*(?:\.\d+)?%?\b/g;
    const numbers = text.match(numberPattern) || [];
    numbers.forEach(num => {
      entities.push({ text: num, type: 'NUMBER' });
    });

    // Extract potential organizations (capitalized words)
    const orgPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
    const orgs = text.match(orgPattern) || [];
    orgs.forEach(org => {
      if (org.length > 3 && !['The', 'This', 'That', 'With', 'When', 'Where', 'What', 'How', 'Why'].includes(org)) {
        entities.push({ text: org, type: 'ORGANIZATION' });
      }
    });

    return entities;
  }

  // Extract factual claims that LLMs can cite
  function extractClaims(text) {
    const claims = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());

    sentences.forEach(sentence => {
      const trimmed = sentence.trim();
      if (trimmed.length > 20) {
        // Look for claim indicators
        const claimIndicators = [
          /according to/i,
          /research shows/i,
          /studies indicate/i,
          /data reveals/i,
          /\d+%/,
          /increased by/i,
          /decreased by/i,
          /found that/i,
          /reported that/i
        ];

        const isFactualClaim = claimIndicators.some(pattern => pattern.test(trimmed));
        
        if (isFactualClaim) {
          claims.push({
            text: trimmed,
            type: 'FACTUAL_CLAIM',
            citationReady: true
          });
        }
      }
    });

    return claims;
  }

  function isQuestionLike(text) {
    const questionWords = /^(how|what|when|where|why|which|who|can|does|is|are|will|would|should)/i;
    const hasQuestionMark = text.includes("?");
    return questionWords.test(text) || hasQuestionMark;
  }

  function shouldSkip(text) {
    const skipPhrases = [
      "Ask, Click, Manifest.",
      "Need an Answer—Fast?"
    ];

    const skipPatterns = [
      /^(share|subscribe|follow|comment)/i,
      /^(advertisement|sponsored|promoted)/i,
      /^(related|similar|more)/i,
      /^(newsletter|signup|join|shop)/i,
      /^(\s*next|previous)\s*/i
    ];

    return (
      skipPhrases.includes(text) ||
      skipPatterns.some((pattern) => pattern.test(text))
    );
  }

  function extractFAQSchema(container) {
    const faqs = [];
    const headings = container.querySelectorAll("h2, h3, h4");

    log(`Found ${headings.length} headings to check for FAQ content`);

    headings.forEach((heading) => {
      const question = heading.textContent.trim();
      if (!isQuestionLike(question) || shouldSkip(question)) return;

      let answer = "";
      let sibling = heading.nextElementSibling;
      let count = 0;

      while (sibling && count < 3) {
        if (sibling.tagName.match(/^H[1-6]$/)) break;
        if (sibling.tagName.toLowerCase() === "p") {
          answer += sibling.textContent.trim() + " ";
        }
        sibling = sibling.nextElementSibling;
        count++;
      }

      answer = answer.trim();
      if (answer.length < 30) return;

      faqs.push({
        "@type": "Question",
        name: question,
        acceptedAnswer: {
          "@type": "Answer",
          text: answer,
          // Add citation metadata for LLMs
          citation: {
            url: window.location.href,
            title: document.title,
            author: extractAuthor(),
            datePublished: extractPublishDate()
          }
        }
      });
    });

    log(`Extracted ${faqs.length} FAQ items`);
    return faqs.length > 0 ? faqs : null;
  }

  function extractAuthor() {
    const authorMeta = document.querySelector('meta[name="author"]') ||
                      document.querySelector('meta[property="article:author"]') ||
                      document.querySelector('[rel="author"]');
    
    if (authorMeta) {
      return authorMeta.getAttribute('content') || authorMeta.textContent || 'Unknown Author';
    }
    
    return 'Unknown Author';
  }

  function extractPublishDate() {
    const dateMeta = document.querySelector('meta[property="article:published_time"]') ||
                    document.querySelector('meta[name="publish_date"]') ||
                    document.querySelector('meta[name="date"]') ||
                    document.querySelector('time[datetime]');
    
    if (dateMeta) {
      return dateMeta.getAttribute('content') || dateMeta.getAttribute('datetime') || new Date().toISOString();
    }
    
    return new Date().toISOString();
  }

  function extractPageContent() {
    const container = getArticleContainer();
    
    // Extract text content, preserving paragraph structure
    const textContent = Array.from(container.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li'))
      .map(el => el.textContent.trim())
      .filter(text => text.length > 20 && !shouldSkip(text))
      .join('\n\n');

    log(`Extracted ${textContent.length} characters of content`);
    return textContent;
  }

  function extractSummary(container) {
    const paragraphs = Array.from(container.querySelectorAll("p"));
    const firstThree = paragraphs.slice(0, 3).map((p) => p.textContent.trim());
    return firstThree.join(" ").substring(0, 300);
  }

  function schemaAlreadyExists(type) {
    const existing = Array.from(
      document.querySelectorAll('script[type="application/ld+json"]')
    );
    return existing.some((el) => el.textContent.includes(`"${type}"`));
  }

  function injectJSONLDSchema(schemaObj) {
    const scriptTag = document.createElement("script");
    scriptTag.type = "application/ld+json";
    scriptTag.textContent = JSON.stringify(schemaObj, null, 2);
    scriptTag.setAttribute('data-rag-injected', 'true');
    document.head.appendChild(scriptTag);
    log(`✓ Injected ${schemaObj["@type"]} schema into <head>`);
    
    // Verify injection worked
    const injectedScript = document.querySelector('script[data-rag-injected="true"]');
    if (injectedScript) {
      log(`✓ Schema injection verified in DOM`);
    } else {
      log(`✗ Schema injection failed`);
    }
  }

  // Main optimization function - exposed globally
  function runRAGOptimization() {
    log("🚀 Starting RAG optimization...");
    
    const container = getArticleContainer();
    const url = window.location.href;
    const title = document.title;
    const summary = extractSummary(container);
    const faqs = extractFAQSchema(container);
    const timestamp = getISOTimestamp();
    
    // Extract and chunk content for RAG
    const content = extractPageContent();
    if (!content || content.length < 100) {
      log("⚠️ Insufficient content found for RAG optimization");
      return false;
    }
    
    const chunks = createSemanticChunks(content);
    
    // Enhanced Article schema with RAG optimization
    if (!schemaAlreadyExists("Article")) {
      const articleSchema = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: title,
        description: summary,
        dateModified: timestamp,
        datePublished: extractPublishDate(),
        mainEntityOfPage: url,
        author: {
          "@type": "Person",
          "name": extractAuthor()
        },
        // RAG-specific enhancements
        "semanticChunks": chunks.map(chunk => ({
          "@type": "TextDigitalDocument",
          "identifier": chunk.chunkId,
          "text": chunk.text,
          "wordCount": chunk.tokens,
          "about": chunk.entities.map(e => e.text),
          "citation": {
            "url": url,
            "title": title,
            "chunkId": chunk.chunkId
          }
        })),
        "keyEntities": chunks.flatMap(chunk => chunk.entities),
        "factualClaims": chunks.flatMap(chunk => chunk.claims),
        "citationReadiness": Math.round((chunks.filter(c => c.citationReady).length / chunks.length) * 100)
      };
      
      injectJSONLDSchema(articleSchema);
    }

    // Enhanced FAQ schema with citation data
    if (faqs && !schemaAlreadyExists("FAQPage")) {
      const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqs
      };
      injectJSONLDSchema(faqSchema);
    }

    // Add ClaimReview schema for factual claims
    const allClaims = chunks.flatMap(chunk => chunk.claims);
    if (allClaims.length > 0 && !schemaAlreadyExists("ClaimReview")) {
      const claimSchema = {
        "@context": "https://schema.org",
        "@type": "ClaimReview",
        "claimReviewed": allClaims.slice(0, 5).map(claim => ({
          "@type": "Claim",
          "text": claim.text,
          "author": extractAuthor(),
          "datePublished": extractPublishDate()
        }))
      };
      injectJSONLDSchema(claimSchema);
    }

    log(`✅ RAG optimization complete:`);
    log(`   - ${chunks.length} semantic chunks created`);
    log(`   - ${allClaims.length} factual claims identified`);
    log(`   - ${faqs ? faqs.length : 0} FAQ items processed`);
    log(`   - Content length: ${content.length} characters`);
    
    return {
      chunks: chunks.length,
      claims: allClaims.length,
      faqs: faqs ? faqs.length : 0,
      contentLength: content.length
    };
  }

  // Expose function globally for console access
  window.runRAGOptimization = runRAGOptimization;
  
  // Also expose individual functions for debugging
  window.ragDebug = {
    getArticleContainer,
    extractPageContent,
    createSemanticChunks,
    extractFAQSchema,
    log
  };

  // Run optimization when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runRAGOptimization);
  } else {
    runRAGOptimization();
  }

  log("RAG optimization script loaded and ready");
})();
