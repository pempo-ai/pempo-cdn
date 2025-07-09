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
  
  // Utility: Check if schema already exists (FIXED)
  function schemaAlreadyExists(type) {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    return Array.from(scripts).some(script => {
      try {
        const content = script.textContent || script.innerHTML;
        if (!content) return false;
        
        const json = JSON.parse(content);
        
        // Handle both single objects and arrays
        if (Array.isArray(json)) {
          return json.some(item => 
            item["@type"] === type || 
            (Array.isArray(item["@type"]) && item["@type"].includes(type))
          );
        }
        
        return json["@type"] === type || 
               (Array.isArray(json["@type"]) && json["@type"].includes(type));
      } catch (e) {
        log(`Error parsing existing schema: ${e.message}`);
        return false;
      }
    });
  }
  
  // Utility: Inject structured data (COMPLETELY REWRITTEN)
  function injectJSONLDSchema(schemaObj) {
    const type = schemaObj["@type"];
    
    // Check for duplicates
    if (schemaAlreadyExists(type)) {
      log(`❌ Skipped injecting duplicate ${type} schema`);
      return false;
    }
    
    try {
      // Create script element
      const scriptTag = document.createElement("script");
      scriptTag.type = "application/ld+json";
      scriptTag.setAttribute('data-rag-injected', 'true');
      scriptTag.setAttribute('data-schema-type', type);
      scriptTag.setAttribute('data-timestamp', getISOTimestamp());
      
      // Set content - use textContent for better compatibility
      const jsonString = JSON.stringify(schemaObj, null, 2);
      scriptTag.textContent = jsonString;
      
      // Wait for DOM to be ready and inject
      const performInjection = () => {
        let injected = false;
        
        // Strategy 1: Try to inject at end of body (preferred for additional schemas)
        if (document.body) {
          try {
            document.body.appendChild(scriptTag);
            injected = true;
            log(`✅ Injected ${type} schema into end of <body>`);
          } catch (e) {
            log(`❌ Failed to inject into body: ${e.message}`);
          }
        }
        
        // Strategy 2: Fallback to head if body injection failed
        if (!injected && document.head) {
          try {
            document.head.appendChild(scriptTag);
            injected = true;
            log(`✅ Injected ${type} schema into <head> (fallback)`);
          } catch (e) {
            log(`❌ Failed to inject into head: ${e.message}`);
          }
        }
        
        // Strategy 3: Last resort - inject before closing body tag
        if (!injected) {
          try {
            document.documentElement.appendChild(scriptTag);
            injected = true;
            log(`✅ Injected ${type} schema into <html> (last resort)`);
          } catch (e) {
            log(`❌ All injection strategies failed: ${e.message}`);
          }
        }
        
        // Verify injection succeeded
        if (injected) {
          // Use a small delay to ensure DOM update
          setTimeout(() => {
            const verification = document.querySelector(`script[data-schema-type="${type}"]`);
            if (verification) {
              log(`✅ Schema injection verified: ${type}`);
              log(`   Content length: ${verification.textContent.length} characters`);
              
              // Additional verification: try to parse the injected JSON
              try {
                const parsedContent = JSON.parse(verification.textContent);
                log(`   JSON parsing successful: ${parsedContent["@type"]}`);
              } catch (parseError) {
                log(`❌ Injected JSON is invalid: ${parseError.message}`);
              }
            } else {
              log(`❌ Schema injection verification failed: ${type}`);
            }
          }, 100);
        }
        
        return injected;
      };
      
      // Ensure DOM is ready before injection
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', performInjection);
      } else {
        return performInjection();
      }
      
      return true;
      
    } catch (error) {
      log(`❌ Error creating ${type} schema: ${error.message}`);
      return false;
    }
  }
  
  // Debug function to list all JSON-LD on page
  function debugExistingSchemas() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    log(`📊 Found ${scripts.length} existing JSON-LD scripts on page:`);
    
    scripts.forEach((script, index) => {
      try {
        const content = script.textContent || script.innerHTML;
        if (content) {
          const json = JSON.parse(content);
          const type = json["@type"] || 'Unknown';
          const isRagInjected = script.getAttribute('data-rag-injected') === 'true';
          log(`   ${index + 1}. Type: ${type} ${isRagInjected ? '(RAG-injected)' : '(existing)'}`);
        }
      } catch (e) {
        log(`   ${index + 1}. Invalid JSON-LD (parse error)`);
      }
    });
  }
  
  // Main Runner
  function runRAGOptimization() {
    log("🚀 RAG optimization starting...");
    
    // Debug existing schemas first
    debugExistingSchemas();
    
    const timestamp = getISOTimestamp();
    const url = window.location.href;
    const title = document.title;
    const summary = extractSummary();
    const faqs = extractFAQSchema();
    
    // Extract and chunk content for RAG
    const content = extractPageContent();
    const chunks = createSemanticChunks(content);
    
    let injectionResults = { success: 0, failed: 0 };
    
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
    
    if (injectJSONLDSchema(articleSchema)) {
      injectionResults.success++;
    } else {
      injectionResults.failed++;
    }
    
    // Enhanced FAQ schema
    if (faqs && faqs.length > 0) {
      const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqs,
      };
      
      if (injectJSONLDSchema(faqSchema)) {
        injectionResults.success++;
      } else {
        injectionResults.failed++;
      }
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
      
      if (injectJSONLDSchema(claimSchema)) {
        injectionResults.success++;
      } else {
        injectionResults.failed++;
      }
    }
    
    // Final summary
    log(`✅ RAG optimization complete:`);
    log(`   - ${chunks.length} semantic chunks created`);
    log(`   - ${allClaims.length} factual claims extracted`);
    log(`   - ${faqs ? faqs.length : 0} FAQ items found`);
    log(`   - ${injectionResults.success} schemas injected successfully`);
    log(`   - ${injectionResults.failed} schema injections failed`);
    
    // Debug schemas again to show what was added
    setTimeout(() => {
      log("📊 Final schema status:");
      debugExistingSchemas();
    }, 500);
    
    return {
      chunks: chunks.length,
      claims: allClaims.length,
      faqs: faqs ? faqs.length : 0,
      injectionResults
    };
  }
  
  // Expose globally for testing
  window.runRAGOptimization = runRAGOptimization;
  window.debugExistingSchemas = debugExistingSchemas;
  
  // Trigger when ready with better timing
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runRAGOptimization);
  } else {
    // Add small delay to ensure page is fully rendered
    setTimeout(runRAGOptimization, 100);
  }
})();
