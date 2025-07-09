(function () {
  // Utility: Log
  const log = (...args) => console.log("[RAG-OPT]", ...args);
  
  // RAG-specific chunking configuration
  const CHUNK_CONFIG = {
    targetTokens: 384,
    overlapTokens: 64,
    minChunkSize: 256,
    maxChunkSize: 512
  };
  
  // Utility: Format date to ISO with timestamp
  function getISOTimestamp() {
    return new Date().toISOString();
  }
  
  // Utility: Get article container with better detection
  function getArticleContainer() {
    const selectors = [
      'article',
      'main',
      '[role="main"]',
      '.post-content',
      '.entry-content',
      '.article-content',
      '.content-body'
    ];
    
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length > 300) {
        log(`Found article container: ${sel}`);
        return el;
      }
    }
    
    // Fallback to largest text container
    const divs = Array.from(document.querySelectorAll('div')).filter(div => {
      const text = div.textContent.trim();
      return text.length > 500 && div.querySelectorAll('p').length > 2;
    });
    
    if (divs.length > 0) {
      const largest = divs.reduce((prev, current) => 
        prev.textContent.length > current.textContent.length ? prev : current
      );
      log(`Found article container via largest div`);
      return largest;
    }
    
    log("Using document.body as fallback");
    return document.body;
  }
  
  // Utility: Estimate token count
  function estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }
  
  // Utility: Extract entities for RAG
  function extractEntities(text) {
    const entities = [];
    
    // Extract numbers and percentages
    const numbers = text.match(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?%?\b/g) || [];
    numbers.forEach(num => {
      entities.push({ text: num, type: 'NUMBER' });
    });
    
    // Extract potential organizations
    const orgs = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    orgs.forEach(org => {
      if (org.length > 3 && !['The', 'This', 'That', 'With', 'When', 'Where'].includes(org)) {
        entities.push({ text: org, type: 'ORGANIZATION' });
      }
    });
    
    return entities;
  }
  
  // Utility: Extract factual claims
  function extractClaims(text) {
    const claims = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());
    
    sentences.forEach(sentence => {
      const trimmed = sentence.trim();
      if (trimmed.length > 20) {
        const claimIndicators = [
          /according to/i,
          /research shows/i,
          /studies indicate/i,
          /data reveals/i,
          /\d+%/,
          /increased by/i,
          /decreased by/i,
          /found that/i
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
  
  // Utility: Create semantic chunks for RAG
  function createSemanticChunks(content) {
    if (!content || content.length < 100) return [];
    
    const chunks = [];
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 50);
    let currentChunk = '';
    let currentTokens = 0;
    
    for (const paragraph of paragraphs) {
      const paraTokens = estimateTokens(paragraph);
      
      if (currentTokens + paraTokens > CHUNK_CONFIG.targetTokens && currentChunk) {
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
        const overlapSentences = sentences.slice(-2);
        currentChunk = overlapSentences.join('. ') + '. ' + paragraph;
        currentTokens = estimateTokens(currentChunk);
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        currentTokens += paraTokens;
      }
    }
    
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
  
  // Utility: Extract page content for chunking
  function extractPageContent() {
    const container = getArticleContainer();
    const textContent = Array.from(container.querySelectorAll('p, h1, h2, h3, h4, h5, h6'))
      .map(el => el.textContent.trim())
      .filter(text => text.length > 20)
      .join('\n\n');
    
    log(`Extracted ${textContent.length} characters of content`);
    return textContent;
  }
  
  // Utility: Extract FAQs (enhanced from original)
  function extractFAQSchema() {
    const faqs = [];
    const headings = document.querySelectorAll("h2, h3");
    
    headings.forEach((heading) => {
      const question = heading.textContent.trim();
      
      // Check if it's question-like
      const isQuestion = /^(how|what|when|where|why|which|who|can|does|is|are|will|would|should)/i.test(question) || 
                        question.includes("?");
      
      if (!isQuestion) return;
      
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
        "name": question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": answer,
          "citation": {
            "url": window.location.href,
            "title": document.title,
            "dateAccessed": getISOTimestamp()
          }
        }
      });
    });
    
    return faqs.length > 0 ? faqs : null;
  }
  
  // Utility: Extract page summary
  function extractSummary() {
    const paragraphs = Array.from(document.querySelectorAll("p"));
    const firstThree = paragraphs.slice(0, 3).map((p) => p.textContent.trim());
    return firstThree.join(" ").substring(0, 500);
  }
  
  // Utility: Check if schema already exists
  function schemaAlreadyExists(type) {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    return Array.from(scripts).some(script => {
      try {
        const json = JSON.parse(script.textContent);
        return json["@type"] === type || (Array.isArray(json["@type"]) && json["@type"].includes(type));
      } catch (e) {
        return false;
      }
    });
  }
  
  // Utility: Inject structured data
  function injectJSONLDSchema(schemaObj) {
    const type = schemaObj["@type"];
    if (schemaAlreadyExists(type)) {
      log(`Skipped injecting duplicate ${type} schema`);
      return;
    }
    const scriptTag = document.createElement("script");
    scriptTag.type = "application/ld+json";
    scriptTag.textContent = JSON.stringify(schemaObj, null, 2);
    scriptTag.setAttribute('data-rag-injected', 'true');
    document.head.appendChild(scriptTag);
    log(`✅ Injected ${type} schema`);
  }
  
  // Main Runner
  function runRAGOptimization() {
    log("🚀 RAG optimization starting...");
    
    const timestamp = getISOTimestamp();
    const url = window.location.href;
    const title = document.title;
    const summary = extractSummary();
    const faqs = extractFAQSchema();
    
    // Extract and chunk content for RAG
    const content = extractPageContent();
    const chunks = createSemanticChunks(content);
    
    // Enhanced Article schema with RAG features
    const articleSchema = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": title,
      "dateModified": timestamp,
      "mainEntityOfPage": url,
      "description": summary,
      "author": {
        "@type": "Person",
        "name": document.querySelector('meta[name="author"]')?.getAttribute('content') || 'Unknown'
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
      "citationReadiness": chunks.length > 0 ? Math.round((chunks.filter(c => c.citationReady).length / chunks.length) * 100) : 0
    };
    
    injectJSONLDSchema(articleSchema);
    
    // Enhanced FAQ schema
    if (faqs) {
      const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqs,
      };
      injectJSONLDSchema(faqSchema);
    }
    
    // ClaimReview schema for factual claims
    const allClaims = chunks.flatMap(chunk => chunk.claims);
    if (allClaims.length > 0) {
      const claimSchema = {
        "@context": "https://schema.org",
        "@type": "ClaimReview",
        "claimReviewed": allClaims.slice(0, 5).map(claim => ({
          "@type": "Claim",
          "text": claim.text,
          "author": document.querySelector('meta[name="author"]')?.getAttribute('content') || 'Unknown',
          "datePublished": timestamp
        }))
      };
      injectJSONLDSchema(claimSchema);
    }
    
    log(`✅ RAG optimization complete:`);
    log(`   - ${chunks.length} semantic chunks`);
    log(`   - ${allClaims.length} factual claims`);
    log(`   - ${faqs ? faqs.length : 0} FAQ items`);
    
    return {
      chunks: chunks.length,
      claims: allClaims.length,
      faqs: faqs ? faqs.length : 0
    };
  }
  
  // Expose globally for testing
  window.runRAGOptimization = runRAGOptimization;
  
  // Trigger when ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runRAGOptimization);
  } else {
    runRAGOptimization();
  }
})();
