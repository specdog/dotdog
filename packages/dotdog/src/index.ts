// dotdog index — build TF-IDF search index
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

interface IndexEntry {
  section: string;
  heading: string;
  file: string;
  content: string;
  vector: number[];
}

interface SearchIndex {
  version: string;
  project: string;
  built: string;
  entries: IndexEntry[];
  vocabulary: string[];
  df: number[]; // document frequency per term
}

function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !stopWords.has(t));
}

const stopWords = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her',
  'was', 'one', 'our', 'out', 'has', 'have', 'been', 'some', 'than', 'that',
  'this', 'with', 'from', 'they', 'will', 'would', 'which', 'their', 'there',
  'about', 'into', 'each', 'said', 'does', 'also', 'after', 'before', 'other',
  'more', 'only', 'over', 'such', 'when', 'where', 'what', 'who', 'how', 'then',
  'just', 'very', 'much', 'well', 'should', 'could', 'through', 'between'
]);

export function buildIndex(projectDir: string, projectName: string): SearchIndex {
  const files = readdirSync(projectDir).filter(f => f.endsWith('.dog'));
  const entries: IndexEntry[] = [];
  const docFreq = new Map<string, number>();
  
  for (const file of files) {
    const content = readFileSync(join(projectDir, file), 'utf-8');
    // Chunk by ## and ### headings
    const sections = content.split(/\n(?=##\s)/);
    for (const section of sections) {
      const lines = section.split('\n');
      const heading = lines[0]?.replace(/^#+\s*/, '') || '(root)';
      const body = lines.slice(1).join('\n');
      if (body.trim().length < 20) continue; // skip empty sections
      
      const terms = tokenize(body);
      if (terms.length < 5) continue;
      
      // Count term frequency
      const tf = new Map<string, number>();
      for (const t of terms) {
        tf.set(t, (tf.get(t) || 0) + 1);
        docFreq.set(t, (docFreq.get(t) || 0) + 1);
      }
      
      entries.push({
        section: heading,
        heading,
        file,
        content: body.slice(0, 500), // first 500 chars for display
        vector: [] // will fill later
      });
    }
  }
  
  // Build vocabulary from terms appearing in at least 2 docs
  const vocabulary = [...docFreq.entries()]
    .filter(([_, df]) => df >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 1000)
    .map(([term]) => term);
  
  const df = vocabulary.map(t => docFreq.get(t) || 0);
  
  // Compute TF-IDF vectors for each entry
  const N = entries.length;
  for (const entry of entries) {
    const terms = tokenize(entry.content);
    const tf = new Map<string, number>();
    for (const t of terms) tf.set(t, (tf.get(t) || 0) + 1);
    
    entry.vector = vocabulary.map(term => {
      const termFreq = tf.get(term) || 0;
      if (termFreq === 0) return 0;
      const docFreqTerm = docFreq.get(term) || 1;
      return (termFreq / terms.length) * Math.log(N / docFreqTerm);
    });
  }
  
  return {
    version: '1.0',
    project: projectName,
    built: new Date().toISOString(),
    entries,
    vocabulary,
    df,
  };
}

export function searchIndex(index: SearchIndex, query: string, limit = 10): { entry: IndexEntry; score: number }[] {
  const queryTerms = tokenize(query);
  const queryVec = index.vocabulary.map(term => queryTerms.includes(term) ? 1 : 0);
  
  const results = index.entries.map(entry => {
    let dot = 0;
    let entryMag = 0;
    let queryMag = 0;
    for (let j = 0; j < queryVec.length; j++) {
      dot += queryVec[j] * entry.vector[j];
      queryMag += queryVec[j] * queryVec[j];
      entryMag += entry.vector[j] * entry.vector[j];
    }
    const score = (queryMag > 0 && entryMag > 0) ? dot / (Math.sqrt(queryMag) * Math.sqrt(entryMag)) : 0;
    return { entry, score };
  });
  
  return results
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
