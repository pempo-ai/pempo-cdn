<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RAG Optimization Service</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .demo-container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }
        .controls {
            display: flex;
            gap: 15px;
            margin-bottom: 30px;
            flex-wrap: wrap;
        }
        button {
            padding: 12px 24px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.2s;
        }
        button:hover {
            background: #0056b3;
        }
        button:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        .status {
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
            font-weight: 500;
        }
        .status.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .status.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .status.processing {
            background: #fff3cd;
            color: #856404;
            border: 1px solid #ffeaa7;
        }
        .output {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            padding: 20px;
            margin-top: 20px;
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 13px;
            white-space: pre-wrap;
            max-height: 400px;
            overflow-y: auto;
        }
        .analytics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        .metric {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            border: 1px solid #dee2e6;
            text-align: center;
        }
        .metric-value {
            font-size: 24px;
            font-weight: bold;
            color: #007bff;
        }
        .metric-label {
            font-size: 12px;
            color: #6c757d;
            margin-top: 5px;
        }
        .embed-snippet {
            background: #2d3748;
            color: #e2e8f0;
            padding: 20px;
            border-radius: 6px;
            margin: 20px 0;
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 13px;
            overflow-x: auto;
        }
        .section-title {
            font-size: 18px;
            font-weight: 600;
            margin: 30px 0 15px 0;
            color: #495057;
        }
        h1 {
            color: #212529;
            margin-bottom: 10px;
        }
        .subtitle {
            color: #6c757d;
            margin-bottom: 30px;
        }
    </style>
</head>
<body>
    <div class="demo-container">
        <h1>RAG Optimization Service</h1>
        <p class="subtitle">Advanced content optimization for LLM citation and discoverability</p>
        
        <div class="controls">
            <button onclick="runOptimization()">Optimize Current Page</button>
            <button onclick="viewGeneratedSchemas()">View Generated Schemas</button>
            <button onclick="testChunking()">Test Chunking Algorithm</button>
            <button onclick="clearOutput()">Clear Output</button>
        </div>
        
        <div id="status" class="status" style="display: none;"></div>
        
        <div class="analytics">
            <div class="metric">
                <div class="metric-value" id="chunkCount">0</div>
                <div class="metric-label">Semantic Chunks</div>
            </div>
            <div class="metric">
                <div class="metric-value" id="citationScore">0</div>
                <div class="metric-label">Citation Readiness Score</div>
            </div>
            <div class="metric">
                <div class="metric-value" id="entityCount">0</div>
                <div class="metric-label">Key Entities</div>
            </div>
            <div class="metric">
                <div class="metric-value" id="schemaTypes">0</div>
                <div class="metric-label">Schema Types</div>
            </div>
        </div>
        
        <div class="section-title">Publisher Embed Snippet</div>
        <div class="embed-snippet">// Simple embed snippet for publishers
(function() {
  const script = document.createElement('script');
  script.src = 'https://your-service.com/embed/v1/optimize.js';
  script.async = true;
  script.setAttribute('data-site-id', 'your-site-id');
  document.head.appendChild(script);
})();</div>
        
        <div id="output" class="output" style="display: none;"></div>
    </div>

    <script>
        class RAGOptimizationService {
            constructor() {
                this.DEBUG = true;
                this.apiEndpoint = 'https://your-service.com/api/v1';
                this.optimizationResults = null;
                this.chunkingConfig = {
                    targetTokens: 384, // Optimal for RAG
                    overlapTokens: 64,
                    minChunkSize: 256,
                    maxChunkSize: 512
                };
            }

            log(...args) {
                if (this.DEBUG) console.log('[RAG-OPT]', ...args);
            }

            showStatus(message, type = 'processing') {
                const statusEl = document.getElementById('status');
                statusEl.textContent = message;
                statusEl.className = `status ${type}`;
                statusEl.style.display = 'block';
            }

            hideStatus() {
                document.getElementById('status').style.display = 'none';
            }

            updateMetrics(data) {
                document.getElementById('chunkCount').textContent = data.chunks || 0;
                document.getElementById('citationScore').textContent = data.citationScore || 0;
                document.getElementById('entityCount').textContent = data.entities || 0;
                document.getElementById('schemaTypes').textContent = data.schemaTypes || 0;
            }

            showOutput(content) {
                const outputEl = document.getElementById('output');
                outputEl.textContent = JSON.stringify(content, null, 2);
                outputEl.style.display = 'block';
            }

            // Estimate token count (rough approximation)
            estimateTokens(text) {
                return Math.ceil(text.length / 4); // Rough estimate: 4 chars per token
            }

            // Extract semantic chunks optimized for RAG
            createSemanticChunks(content) {
                const chunks = [];
                const paragraphs = content.split(/\n\s*\n/);
                let currentChunk = '';
                let currentTokens = 0;

                for (const paragraph of paragraphs) {
                    const paraTokens = this.estimateTokens(paragraph);
                    
                    if (currentTokens + paraTokens > this.chunkingConfig.targetTokens && currentChunk) {
                        // Create chunk with metadata
                        chunks.push({
                            text: currentChunk.trim(),
                            tokens: currentTokens,
                            chunkId: `chunk_${chunks.length}`,
                            semanticContext: this.extractSemanticContext(currentChunk),
                            citationMetadata: this.generateCitationMetadata(currentChunk, chunks.length)
                        });

                        // Start new chunk with overlap
                        const overlapText = this.getOverlapText(currentChunk, this.chunkingConfig.overlapTokens);
                        currentChunk = overlapText + '\n\n' + paragraph;
                        currentTokens = this.estimateTokens(currentChunk);
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
                        semanticContext: this.extractSemanticContext(currentChunk),
                        citationMetadata: this.generateCitationMetadata(currentChunk, chunks.length)
                    });
                }

                return chunks;
            }

            getOverlapText(text, targetTokens) {
                const sentences = text.split(/[.!?]+/).filter(s => s.trim());
                let overlap = '';
                let tokens = 0;

                for (let i = sentences.length - 1; i >= 0; i--) {
                    const sentence = sentences[i] + '.';
                    const sentenceTokens = this.estimateTokens(sentence);
                    
                    if (tokens + sentenceTokens <= targetTokens) {
                        overlap = sentence + ' ' + overlap;
                        tokens += sentenceTokens;
                    } else {
                        break;
                    }
                }

                return overlap.trim();
            }

            extractSemanticContext(text) {
                // Extract key entities, concepts, and relationships
                const entities = this.extractEntities(text);
                const concepts = this.extractConcepts(text);
                const claims = this.extractClaims(text);

                return {
                    entities,
                    concepts,
                    claims,
                    topicCategory: this.classifyTopic(text),
                    confidenceScore: this.calculateConfidence(text)
                };
            }

            extractEntities(text) {
                // Simple entity extraction (in production, use NLP library)
                const entities = [];
                
                // Extract potential company names (capitalized words)
                const companyPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
                const matches = text.match(companyPattern) || [];
                
                matches.forEach(match => {
                    if (match.length > 3 && !['The', 'This', 'That', 'With', 'When', 'Where'].includes(match)) {
                        entities.push({
                            text: match,
                            type: 'ORGANIZATION',
                            confidence: 0.8
                        });
                    }
                });

                // Extract numbers and dates
                const numberPattern = /\b\d{1,3}(?:,\d{3})*(?:\.\d+)?%?\b/g;
                const numbers = text.match(numberPattern) || [];
                numbers.forEach(num => {
                    entities.push({
                        text: num,
                        type: 'NUMBER',
                        confidence: 0.9
                    });
                });

                return entities;
            }

            extractConcepts(text) {
                // Extract key concepts and topics
                const concepts = [];
                const conceptPatterns = [
                    /\b(?:artificial intelligence|AI|machine learning|ML|deep learning)\b/gi,
                    /\b(?:search engine optimization|SEO|content marketing)\b/gi,
                    /\b(?:revenue|profit|growth|market share|ROI)\b/gi,
                    /\b(?:technology|innovation|digital transformation)\b/gi
                ];

                conceptPatterns.forEach(pattern => {
                    const matches = text.match(pattern) || [];
                    matches.forEach(match => {
                        concepts.push({
                            term: match.toLowerCase(),
                            relevance: 0.8,
                            frequency: (text.match(new RegExp(match, 'gi')) || []).length
                        });
                    });
                });

                return concepts;
            }

            extractClaims(text) {
                // Extract factual claims that can be cited
                const claims = [];
                const sentences = text.split(/[.!?]+/).filter(s => s.trim());

                sentences.forEach((sentence, index) => {
                    const trimmed = sentence.trim();
                    if (trimmed.length > 20) {
                        // Look for claim indicators
                        const claimIndicators = [
                            /according to/i,
                            /research shows/i,
                            /studies indicate/i,
                            /data reveals/i,
                            /statistics show/i,
                            /\d+%/,
                            /increased by/i,
                            /decreased by/i
                        ];

                        const isFactualClaim = claimIndicators.some(pattern => pattern.test(trimmed));
                        
                        if (isFactualClaim) {
                            claims.push({
                                text: trimmed,
                                type: 'FACTUAL_CLAIM',
                                confidence: 0.9,
                                position: index,
                                citationReady: true
                            });
                        }
                    }
                });

                return claims;
            }

            classifyTopic(text) {
                const topics = {
                    'technology': /\b(?:AI|technology|software|digital|tech|innovation|algorithm|data|analytics)\b/gi,
                    'business': /\b(?:business|market|revenue|profit|sales|growth|strategy|ROI)\b/gi,
                    'health': /\b(?:health|medical|healthcare|treatment|disease|wellness|fitness)\b/gi,
                    'finance': /\b(?:finance|investment|stock|money|banking|crypto|financial)\b/gi,
                    'education': /\b(?:education|learning|school|university|teaching|academic)\b/gi
                };

                let maxScore = 0;
                let primaryTopic = 'general';

                Object.keys(topics).forEach(topic => {
                    const matches = text.match(topics[topic]) || [];
                    const score = matches.length;
                    if (score > maxScore) {
                        maxScore = score;
                        primaryTopic = topic;
                    }
                });

                return primaryTopic;
            }

            calculateConfidence(text) {
                // Calculate confidence score based on various factors
                let score = 0.5; // Base score

                // Factor 1: Length (longer text generally more informative)
                if (text.length > 500) score += 0.1;
                if (text.length > 1000) score += 0.1;

                // Factor 2: Presence of numbers/statistics
                const numberMatches = text.match(/\d+%|\d+(?:,\d{3})*(?:\.\d+)?/g) || [];
                score += Math.min(numberMatches.length * 0.05, 0.2);

                // Factor 3: Authoritative language
                const authPatterns = [
                    /according to/i,
                    /research shows/i,
                    /studies indicate/i,
                    /data reveals/i,
                    /experts say/i
                ];
                const authMatches = authPatterns.reduce((count, pattern) => {
                    return count + (text.match(pattern) || []).length;
                }, 0);
                score += Math.min(authMatches * 0.1, 0.3);

                return Math.min(score, 1.0);
            }

            generateCitationMetadata(text, chunkIndex) {
                return {
                    chunkId: `chunk_${chunkIndex}`,
                    sourceUrl: window.location.href,
                    title: document.title,
                    author: this.extractAuthor(),
                    publishDate: this.extractPublishDate(),
                    lastModified: new Date().toISOString(),
                    contentType: 'article',
                    citationFormat: {
                        apa: this.generateAPACitation(),
                        chicago: this.generateChicagoCitation(),
                        mla: this.generateMLACitation()
                    },
                    factualClaims: this.extractClaims(text).filter(claim => claim.citationReady),
                    keyEntities: this.extractEntities(text),
                    topicRelevance: this.classifyTopic(text)
                };
            }

            extractAuthor() {
                // Try to extract author from meta tags or structured data
                const authorMeta = document.querySelector('meta[name="author"]');
                const authorJsonLd = document.querySelector('script[type="application/ld+json"]');
                
                if (authorMeta) return authorMeta.getAttribute('content');
                
                if (authorJsonLd) {
                    try {
                        const data = JSON.parse(authorJsonLd.textContent);
                        if (data.author) return data.author.name || data.author;
                    } catch (e) {
                        // Ignore parsing errors
                    }
                }

                return 'Unknown Author';
            }

            extractPublishDate() {
                const dateMeta = document.querySelector('meta[property="article:published_time"]') ||
                              document.querySelector('meta[name="publish_date"]');
                
                if (dateMeta) return dateMeta.getAttribute('content');
                
                return new Date().toISOString();
            }

            generateAPACitation() {
                const author = this.extractAuthor();
                const year = new Date(this.extractPublishDate()).getFullYear();
                const title = document.title;
                const url = window.location.href;
                
                return `${author} (${year}). ${title}. Retrieved from ${url}`;
            }

            generateChicagoCitation() {
                const author = this.extractAuthor();
                const title = document.title;
                const url = window.location.href;
                const date = new Date().toLocaleDateString();
                
                return `${author}. "${title}." Accessed ${date}. ${url}.`;
            }

            generateMLACitation() {
                const author = this.extractAuthor();
                const title = document.title;
                const url = window.location.href;
                const date = new Date().toLocaleDateString();
                
                return `${author}. "${title}." Web. ${date}. <${url}>.`;
            }

            generateOptimizedSchemas(content, chunks) {
                const schemas = [];

                // Enhanced Article Schema with RAG optimization
                const articleSchema = {
                    "@context": "https://schema.org",
                    "@type": "Article",
                    "headline": document.title,
                    "description": content.substring(0, 300),
                    "author": {
                        "@type": "Person",
                        "name": this.extractAuthor()
                    },
                    "datePublished": this.extractPublishDate(),
                    "dateModified": new Date().toISOString(),
                    "mainEntityOfPage": window.location.href,
                    "publisher": {
                        "@type": "Organization",
                        "name": window.location.hostname
                    },
                    // RAG-specific enhancements
                    "semanticChunks": chunks.map(chunk => ({
                        "@type": "TextDigitalDocument",
                        "identifier": chunk.chunkId,
                        "text": chunk.text,
                        "about": chunk.semanticContext.concepts.map(c => c.term),
                        "mentions": chunk.semanticContext.entities.map(e => e.text),
                        "citation": chunk.citationMetadata.citationFormat
                    })),
                    "keyEntities": this.getAllEntities(chunks),
                    "topicCategories": this.getTopicCategories(chunks),
                    "citationReadinessScore": this.calculateCitationReadiness(chunks)
                };

                schemas.push(articleSchema);

                // Generate FAQ Schema from semantic analysis
                const faqItems = this.generateFAQFromChunks(chunks);
                if (faqItems.length > 0) {
                    schemas.push({
                        "@context": "https://schema.org",
                        "@type": "FAQPage",
                        "mainEntity": faqItems
                    });
                }

                // Generate ClaimReview Schema for factual claims
                const claimReviews = this.generateClaimReviews(chunks);
                if (claimReviews.length > 0) {
                    schemas.push({
                        "@context": "https://schema.org",
                        "@type": "ClaimReview",
                        "claimReviewed": claimReviews
                    });
                }

                return schemas;
            }

            getAllEntities(chunks) {
                const allEntities = [];
                chunks.forEach(chunk => {
                    chunk.semanticContext.entities.forEach(entity => {
                        if (!allEntities.find(e => e.text === entity.text)) {
                            allEntities.push(entity);
                        }
                    });
                });
                return allEntities;
            }

            getTopicCategories(chunks) {
                const categories = {};
                chunks.forEach(chunk => {
                    const topic = chunk.semanticContext.topicCategory;
                    categories[topic] = (categories[topic] || 0) + 1;
                });
                return Object.keys(categories).sort((a, b) => categories[b] - categories[a]);
            }

            calculateCitationReadiness(chunks) {
                const totalChunks = chunks.length;
                const readyChunks = chunks.filter(chunk => 
                    chunk.semanticContext.claims.some(claim => claim.citationReady)
                ).length;
                
                return Math.round((readyChunks / totalChunks) * 100);
            }

            generateFAQFromChunks(chunks) {
                const faqItems = [];
                
                chunks.forEach(chunk => {
                    // Look for question-like patterns in the text
                    const sentences = chunk.text.split(/[.!?]+/);
                    sentences.forEach((sentence, index) => {
                        const trimmed = sentence.trim();
                        if (this.isQuestionLike(trimmed) && index < sentences.length - 1) {
                            const answer = sentences[index + 1]?.trim();
                            if (answer && answer.length > 20) {
                                faqItems.push({
                                    "@type": "Question",
                                    "name": trimmed + "?",
                                    "acceptedAnswer": {
                                        "@type": "Answer",
                                        "text": answer,
                                        "citation": chunk.citationMetadata.citationFormat.apa
                                    }
                                });
                            }
                        }
                    });
                });

                return faqItems.slice(0, 5); // Limit to top 5 FAQ items
            }

            isQuestionLike(text) {
                const questionWords = /^(how|what|when|where|why|which|who|can|does|is|are|will|would|should)/i;
                return questionWords.test(text) || text.includes('?');
            }

            generateClaimReviews(chunks) {
                const claims = [];
                
                chunks.forEach(chunk => {
                    chunk.semanticContext.claims.forEach(claim => {
                        if (claim.citationReady) {
                            claims.push({
                                "@type": "Claim",
                                "text": claim.text,
                                "author": this.extractAuthor(),
                                "datePublished": this.extractPublishDate(),
                                "appearance": {
                                    "@type": "OpinionNewsArticle",
                                    "headline": document.title,
                                    "url": window.location.href
                                }
                            });
                        }
                    });
                });

                return claims;
            }

            injectSchemas(schemas) {
                schemas.forEach((schema, index) => {
                    const script = document.createElement('script');
                    script.type = 'application/ld+json';
                    script.id = `rag-schema-${index}`;
                    script.textContent = JSON.stringify(schema, null, 2);
                    document.head.appendChild(script);
                });
            }

            extractPageContent() {
                // Get main content area
                const selectors = [
                    'main article',
                    '[role="main"]',
                    '.entry-content',
                    '.post-content',
                    '.article-content',
                    '.content'
                ];

                let container = null;
                for (const selector of selectors) {
                    container = document.querySelector(selector);
                    if (container) break;
                }

                if (!container) container = document.body;

                // Extract text content, preserving paragraph structure
                const textContent = Array.from(container.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li'))
                    .map(el => el.textContent.trim())
                    .filter(text => text.length > 20)
                    .join('\n\n');

                return textContent;
            }

            async runOptimization() {
                this.showStatus('Analyzing page content...', 'processing');
                
                try {
                    // Extract page content
                    const content = this.extractPageContent();
                    
                    // Create semantic chunks
                    const chunks = this.createSemanticChunks(content);
                    
                    // Generate optimized schemas
                    const schemas = this.generateOptimizedSchemas(content, chunks);
                    
                    // Inject schemas into page
                    this.injectSchemas(schemas);
                    
                    // Update analytics
                    this.updateMetrics({
                        chunks: chunks.length,
                        citationScore: this.calculateCitationReadiness(chunks),
                        entities: this.getAllEntities(chunks).length,
                        schemaTypes: schemas.length
                    });
                    
                    this.optimizationResults = {
                        content,
                        chunks,
                        schemas,
                        timestamp: new Date().toISOString()
                    };
                    
                    this.showStatus('✅ Page optimized successfully for RAG citation!', 'success');
                    
                } catch (error) {
                    this.log('Optimization error:', error);
                    this.showStatus('❌ Optimization failed. Please try again.', 'error');
                }
            }

            viewGeneratedSchemas() {
                if (!this.optimizationResults) {
                    this.showStatus('Please run optimization first', 'error');
                    return;
                }

                this.showOutput(this.optimizationResults.schemas);
            }

            testChunking() {
                if (!this.optimizationResults) {
                    this.showStatus('Please run optimization first', 'error');
                    return;
                }

                const chunkSummary = this.optimizationResults.chunks.map(chunk => ({
                    chunkId: chunk.chunkId,
                    tokens: chunk.tokens,
                    entities: chunk.semanticContext.entities.length,
                    claims: chunk.semanticContext.claims.length,
                    preview: chunk.text.substring(0, 100) + '...'
                }));

                this.showOutput(chunkSummary);
            }

            clearOutput() {
                document.getElementById('output').style.display = 'none';
                this.hideStatus();
            }
        }

        // Initialize the service
        const ragService = new RAGOptimizationService();

        // Global functions for buttons
        function runOptimization() {
            ragService.runOptimization();
        }

        function viewGeneratedSchemas() {
            ragService.viewGeneratedSchemas();
        }

        function testChunking() {
            ragService.testChunking();
        }

        function clearOutput() {
            ragService.clearOutput();
        }

        // Auto-run optimization when page loads (for demo)
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                runOptimization();
            }, 1000);
        });
    </script>
</body>
</html>
