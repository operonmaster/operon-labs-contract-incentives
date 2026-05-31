import Link from "next/link";

import { demoScenarios } from "../../../components/demo-catalog";
import { LabsHero, LabsPageShell, LabsProductFrame } from "../../../components/labs-ui";
import { LabsSiteNav } from "../../../components/labs-site/LabsSiteNav";
import {
  experimentFramingBySlug,
  experimentMethodSteps,
  type CurrentExperimentSlug
} from "../../../components/labs-site/labs-site-content";

function isCurrentExperimentSlug(slug: string): slug is CurrentExperimentSlug {
  return slug in experimentFramingBySlug;
}

export default function ExperimentsPage() {
  return (
    <LabsPageShell className="labs-magazine-page">
      <LabsSiteNav activeId="experiments" />

      <LabsHero compact eyebrow="Experiments" title="Experiments you can inspect.">
        <p>
          Each experiment starts with an operational trust gap, then turns it into a workflow, evidence packet, policy
          decision, and controlled execution path.
        </p>
      </LabsHero>

      <LabsProductFrame title="Experiment method" meta="Trust gap to working prototype">
        <ol className="labs-magazine-method-list">
          {experimentMethodSteps.map((step, index) => (
            <li key={step}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step}</strong>
            </li>
          ))}
        </ol>
      </LabsProductFrame>

      <section className="labs-magazine-experiment-grid" aria-label="Current Labs experiments">
        {demoScenarios.map((scenario) => (
          <Link className="labs-magazine-experiment-card" href={`/${scenario.slug}`} key={scenario.slug}>
            <span className="eyebrow">{scenario.submitter}</span>
            <h2>{scenario.title}</h2>
            <p>{isCurrentExperimentSlug(scenario.slug) ? experimentFramingBySlug[scenario.slug] : scenario.purpose}</p>
            <em>{scenario.status}</em>
          </Link>
        ))}
      </section>
    </LabsPageShell>
  );
}
