export function extractHowToSteps(markdown?: string | null): string[] {
  if (!markdown) return [];

  const lines = markdown.split(/\r?\n/);
  const steps: string[] = [];
  let currentStep: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch) {
      if (currentStep) {
        steps.push(currentStep);
        currentStep = null;
      }
      continue;
    }

    const stepMatch = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (stepMatch) {
      if (currentStep) {
        steps.push(currentStep);
      }
      currentStep = stepMatch[2];
      continue;
    }

    const imageMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
    if (imageMatch && currentStep) {
      currentStep += ` [Image: ${imageMatch[1] || "Step illustration"}]`;
      continue;
    }

    if (currentStep && line.match(/^[^#\d\-*+]/)) {
      currentStep += " " + line.replace(/^\s*[-*+]\s*/, "").trim();
    }
  }

  if (currentStep) {
    steps.push(currentStep);
  }

  return steps.slice(0, 10);
}
