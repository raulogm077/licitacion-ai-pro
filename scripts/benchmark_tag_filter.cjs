const { performance } = require('perf_hooks');

const numSuggestions = 10000;
const numTags = 1000;
const suggestions = Array.from({ length: numSuggestions }, (_, i) => "suggestion-" + i);
const tags = Array.from({ length: numTags }, (_, i) => "suggestion-" + (i * 2));
const inputValue = "SUGGest";

function originalFilter(suggestions, tags, inputValue) {
    if (inputValue.trim()) {
        const filtered = suggestions.filter(s =>
            s.toLowerCase().includes(inputValue.toLowerCase()) &&
            !tags.includes(s)
        );
        return filtered;
    }
    return [];
}

function optimizedFilter(suggestions, tags, inputValue) {
    const query = inputValue.trim().toLowerCase();
    if (query) {
        const tagSet = new Set(tags);
        const filtered = suggestions.filter(s =>
            s.toLowerCase().includes(query) &&
            !tagSet.has(s)
        );
        return filtered;
    }
    return [];
}

function benchmark(name, fn, iterations = 100) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        fn(suggestions, tags, inputValue);
    }
    const end = performance.now();
    console.log(name + ": " + (end - start).toFixed(4) + "ms (average over " + iterations + " iterations)");
    return end - start;
}

// Verify correctness
const resOrig = originalFilter(suggestions, tags, inputValue);
const resOpt = optimizedFilter(suggestions, tags, inputValue);
console.log("Correctness check: " + (JSON.stringify(resOrig) === JSON.stringify(resOpt) ? "PASS" : "FAIL"));
if (resOrig.length !== resOpt.length) {
    console.log("Lengths: Orig=" + resOrig.length + ", Opt=" + resOpt.length);
}

console.log("Benchmarking with " + numSuggestions + " suggestions and " + numTags + " tags...");
benchmark("Original", originalFilter);
benchmark("Optimized", optimizedFilter);
