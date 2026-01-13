export interface FootnoteRef {
  label: string;
  start: number;
  end: number;
}

interface FootnoteDef {
  label: string;
  start: number;
  end: number;
}

export function findAllReferences(doc: string): FootnoteRef[] {
  const refs: FootnoteRef[] = [];
  const pattern = /\[\^(\d+)\](?!:)/g;
  let match;
  while ((match = pattern.exec(doc)) !== null) {
    refs.push({
      label: match[1],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return refs;
}

function findAllDefinitions(doc: string): FootnoteDef[] {
  const defs: FootnoteDef[] = [];
  const pattern = /^\[\^(\d+)\]:.*$/gm;
  let match;
  while ((match = pattern.exec(doc)) !== null) {
    defs.push({
      label: match[1],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return defs;
}

export function findFootnoteDefinitionPos(doc: string, label: string): number | null {
  const pattern = new RegExp(`\\[\\^${label}\\]:`, "m");
  const match = pattern.exec(doc);
  return match ? match.index : null;
}

export function renumberFootnotesDoc(doc: string): string | null {
  const refs = findAllReferences(doc);
  if (refs.length === 0) return null;

  const labelMap = new Map<string, string>();
  const seenLabels = new Set<string>();
  let nextNum = 1;

  for (const ref of refs) {
    if (!seenLabels.has(ref.label)) {
      seenLabels.add(ref.label);
      labelMap.set(ref.label, String(nextNum));
      nextNum++;
    }
  }

  let needsRenumber = false;
  for (const [oldLabel, newLabel] of labelMap) {
    if (oldLabel !== newLabel) {
      needsRenumber = true;
      break;
    }
  }
  if (!needsRenumber) return null;

  let result = doc;

  const defs = findAllDefinitions(result);
  for (let i = defs.length - 1; i >= 0; i--) {
    const def = defs[i];
    const newLabel = labelMap.get(def.label);
    if (newLabel && newLabel !== def.label) {
      const defPattern = new RegExp(`\\[\\^${def.label}\\]:`);
      const lineContent = result.slice(def.start, def.end);
      const newLineContent = lineContent.replace(defPattern, `[^${newLabel}]:`);
      result = result.slice(0, def.start) + newLineContent + result.slice(def.end);
    }
  }

  const updatedRefs = findAllReferences(result);
  for (let i = updatedRefs.length - 1; i >= 0; i--) {
    const ref = updatedRefs[i];
    const newLabel = labelMap.get(ref.label);
    if (newLabel && newLabel !== ref.label) {
      result = result.slice(0, ref.start) + `[^${newLabel}]` + result.slice(ref.end);
    }
  }

  return result;
}
