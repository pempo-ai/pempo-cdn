(function () {
  // Utility: Format date to ISO with timestamp
  function getISOTimestamp() {
    return new Date().toISOString();
  }

  // Utility: Extract FAQs
  function extractFAQSchema() {
    const faqs = [];
    const headings = document.querySelectorAll("h2, h3");

    headings.forEach((heading) => {
      const question = heading.textContent.trim();
      const next = heading.nextElementSibling;
      if (next && next.tagName.toLowerCase() === "p") {
        const answer = next.textContent.trim();
        faqs.push({
          "@type": "Question",
          "name": question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": answer,
          },
        });
      }
    });

    return faqs.length > 0 ? faqs : null;
  }

  // Utility: Extract page summary
  function extractSummary() {
    const paragraphs = Array.from(document.querySelectorAll("p"));
    const firstThree = paragraphs.slice(0, 3).map((p) => p.textContent.trim());
    return firstThree.join(" ").substring(0, 500);
  }

  // Utility: Inject structured data
  function injectJSONLDSchema(schemaObj) {
    const scriptTag = document.createElement("script");
    scriptTag.type = "application/ld+json";
    scriptTag.textContent = JSON.stringify(schemaObj, null, 2);
    document.head.appendChild(scriptTag);
  }

  // Main Runner
  function runPEMPOEmbed() {
    const timestamp = getISOTimestamp();
    const url = window.location.href;
    const title = document.title;
    const summary = extractSummary();
    const faqs = extractFAQSchema();

    // Article schema
    const articleSchema = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": title,
      "dateModified": timestamp,
      "mainEntityOfPage": url,
      "description": summary,
    };
    injectJSONLDSchema(articleSchema);

    // FAQ schema
    if (faqs) {
      const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqs,
      };
      injectJSONLDSchema(faqSchema);
    }
        // RAG-friendly metadata for LLMs
  const ragChunks = {
    "@pempo": {
      url: url,
      title: title,
      summary: summary,
      timestamp: timestamp,
      headings: Array.from(document.querySelectorAll("h2, h3")).map(h => h.textContent.trim()),
      faqQuestions: faqs ? faqs.map(f => f.name) : [],
    }
  };
  window.__PEMPO_RAG__ = ragChunks;
  console.log("[PEMPO] Injected schema and RAG metadata:", ragChunks);
  }

  // Trigger when ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runPEMPOEmbed);
  } else {
    runPEMPOEmbed();
  }
})();
