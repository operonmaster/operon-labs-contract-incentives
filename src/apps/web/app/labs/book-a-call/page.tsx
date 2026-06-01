import { LabsHero, LabsPageShell, LabsProductFrame } from "../../../components/labs-ui";
import { LabsSiteNav } from "../../../components/labs-site/LabsSiteNav";
import { BookACallForm } from "./BookACallForm";

const expectationItems = [
  {
    title: "Discovery, not a demo",
    body: "We start with your workflow, constraint, stakeholders, and implementation pressure before we talk product."
  },
  {
    title: "Talk to the Labs team",
    body: "You will speak with people who understand clinical operations, evidence, identity, consent, incentives, and value flow."
  },
  {
    title: "30-minute working conversation",
    body: "Use the time to test fit, sharpen the operating question, and decide whether Labs is the right path."
  },
  {
    title: "Clear next step",
    body: "Leave with a practical recommendation: retire the idea, model it further, or shape a co-innovation track."
  }
];

export default function BookACallPage() {
  return (
    <LabsPageShell className="labs-proof-page">
      <LabsSiteNav activeId="book-a-call" />

      <LabsHero compact eyebrow="Book a Call" title="Talk through a healthcare operations workflow.">
        <p>
          No pitch deck. No pressure. Bring the workflow, operating constraint, or innovation question you are trying to
          move from idea to implementation.
        </p>
      </LabsHero>

      <LabsProductFrame className="labs-book-intake-frame" title="Book a Call" meta="Healthcare operations intake">
        <section className="labs-book-layout" aria-label="Book a call with Operon Labs">
          <div className="labs-book-context">
            <span className="label">What to expect</span>
            <h2>Start with the operating problem.</h2>
            <p>
              This is the right conversation when a healthcare operations leader needs a sharper path from strategy to
              something stakeholders can inspect, govern, and decide on.
            </p>

            <div className="labs-book-expectations">
              {expectationItems.map((item) => (
                <article className="labs-book-expectation" key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </div>

          <BookACallForm />
        </section>
      </LabsProductFrame>
    </LabsPageShell>
  );
}
