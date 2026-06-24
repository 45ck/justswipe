# Why JustSwipe Exists

JustSwipe is a response to a real product problem: AI agents can make work faster, but supervising them can create a new layer of attention cost.

Normal Codex chat works well when you are actively focused in the thread. It works less well when you are trying to continue your day and Codex needs a small judgment every few minutes: choose an option, confirm a direction, review a screen, clarify scope, or decide whether to keep going.

JustSwipe turns those moments into a lower-friction loop:

1. Codex pauses at a decision.
2. JustSwipe shows one clear card.
3. The user swipes or adds a short answer.
4. The bridge sends structured feedback back to Codex.
5. Codex resumes or asks the next useful card.

The bet is not that every agent action should become a swipe. The bet is that human judgment should be requested in a way that respects attention.

JustSwipe also treats the card as a small review artifact, not just a text prompt. Codex can attach the context that makes a decision fast: an HTML artifact, diagram, screenshot summary, UI preview, code diff, evidence checklist, or a short form with model-defined fields. The user can tune what belongs on cards for each repo.

## Product Thesis

- AI agents increase output, but also increase oversight.
- More oversight means more micro-decisions.
- More micro-decisions can create decision fatigue and context switching.
- A swipe card can compress many small steering moments into a fast, low-attention interaction.
- A phone-friendly decision layer lets agentic work continue while the user is away from the main machine.
- HTML artifacts and visual review surfaces can make agent output easier to inspect than long Markdown or chat logs when the user needs to make a judgment.

## Sources

- [Harvard Business Review: When Using AI Leads to "Brain Fry"](https://hbr.org/2026/03/when-using-ai-leads-to-brain-fry)
- [Thoughtworks: The Paradox of Acceleration](https://www.thoughtworks.com/en-us/insights/blog/generative-ai/paradox-acceleration-overcoming-ai-decision-fatigue-bottlenecks)
- [Fast Company: How AI Is Quietly Exhausting You](https://www.fastcompany.com/91523806/how-ai-is-quietly-exhausting-you-and-what-to-do-about-it)
- [The Decision Lab: Decision Fatigue](https://thedecisionlab.com/biases/decision-fatigue)
- [American Psychological Association: Why Our Attention Spans Are Shrinking](https://www.apa.org/news/podcasts/speaking-of-psychology/attention-spans)
- [Lenny's Newsletter: HTML Is The New Markdown](https://www.lennysnewsletter.com/p/how-i-ai-html-is-the-new-markdown)
- [Simon Willison: The Unreasonable Effectiveness Of HTML](https://simonwillison.net/2026/May/8/unreasonable-effectiveness-of-html/)
