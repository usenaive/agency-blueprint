# 📖 Product testing team: Operator's Manual

> 👋 This is how you run your product testing team. Start with Setup: three answers, then two things on day one.

## 🧭 Overview

This company is an agency that tests clients' live products. Testers use each client's product as a real customer would, push on its edges, and write up every gap with steps to reproduce. A CRM holds every lead and client.

Every browser session waits for your yes, with the address on its card. Every email waits for your yes. Testing happens only on products a client has asked you to test, in writing.

**You:** say what kinds of products your clients ship and which journeys matter. Get written permission and scope from each client. Approve each test session and each report.

**The team:** plans each client's week every Monday, walks each journey as a new customer and then tries the odd paths, and writes each gap with steps, what happened and what should have.

## 🛠️ Setup

You answer three questions. Every agent reads them before each run.

- **What does your agency do, and for whom?** "We test sign-up and checkout for online stores."
- **What do you sell, and for about how much?** Your packages, as you quote them.
- **What kinds of products do your clients ship, and which journeys matter most?** "Web shops. Sign-up, checkout, returns."

On day one:

- [ ] Connect your email domain.
- [ ] Write your scope letter: what you test, where, when, with which test accounts, and what you never do.

> ⚠️ Never test a product without the owner's written permission and an agreed scope. Use test accounts the client gives you. Never try to reach other people's data, never overload a service, and stop at once if you find something that harms real users. Report it to the client first.

## 🤝 Agent team configuration

- **New business is your agency's.** Its sales finds and signs clients for every team, and hands each one to the security lead.
- **Security lead.** It runs each client, compiles each job's pieces into one report for your review, sends it after your yes and books the retest. It books a call with a client only when you or the CEO ask for one. It asks before any email goes out.
- **Customer tester** uses the product the way a new customer would, step by step, and reports where it gets hard: unclear words, dead ends, slow steps, broken pages. Each session asks you first.
- **Edge-case tester** pushes on the journeys the customer tester walked: odd inputs, odd orders, back buttons, broken states. It stays inside the scope letter. Each session asks you first.

## 🗓️ Scheduling & automation

- **Every Monday:** the week ahead. The security lead plans each client's week.

Testing runs when a card asks for it, and each browser session waits for your yes. For each journey:

1. You write the journey and the scope on a card.
2. The customer tester walks it and files what it found.
3. The edge-case tester pushes on the same journey, when the card asks for edge cases.
4. The security lead compiles the job's pieces into one report once every card is done. You review that report. It waits in Needs you, and the CEO tells you in your chat.
5. The security lead sends it and books a retest.

The team never tests on its own. There is no timer for testing, so nothing touches a client's product unless a card asks for it and you approve the session.

## 📋 Operations

**For every client**

- [ ] Signed scope letter on file.
- [ ] Test accounts from the client, noted in the CRM.
- [ ] The journeys, in the client's words, each as a card.

**For every gap**

- [ ] Steps to reproduce, numbered.
- [ ] What happened, and what should have.
- [ ] How bad it is for a customer: blocks them, slows them, or confuses them.
- [ ] A screenshot from the session.

**Every Monday**

- [ ] Read each client's week ahead.
- [ ] Check which gaps wait for a retest.

> 💡 Write each gap so a developer who has never seen the product can reproduce it on the first try.

## 💸 Monetization

- **Journey test.** One price per journey tested and reported.
- **Release check.** A fixed price to retest key journeys before each release.
- **Monthly plan.** A set number of journeys each month, plus retests.

Put the scope, the dates and the price in one letter the client signs. Charge for a retest apart from the first test, so fixing gaps has a clear next step. Never charge by the number of gaps found: it rewards noise over care.

Price above the team's spend per journey. The CEO can read that spend. Put your packages in your setup answer. This manual makes no claim about what an agency earns.

## 🌱 Growth

1. **Own one kind of product.** Journeys and gaps repeat, and reports get sharper.
2. **Sell the retest.** Every report ends with an offer to check the fixes.
3. **Sell release checks** to clients who ship often.
4. **Add a product type** once the first one is steady.
5. **Keep a checklist per product type.** Save the gaps you find often in a doc in Playbooks. Every seat can read Playbooks. Tell the testers to start from it, so each new client gets the lessons of the last.

Don't grow into work you aren't set up for, such as attacking servers or networks. That needs other skills, other permissions and other insurance.

## 🔧 Troubleshooting

- **A session was refused.** The address is outside the scope letter, or you didn't approve it. Check the card's address against the scope.
- **The tester can't sign in.** The test account is wrong or expired. Ask the client for a new one and update the CRM.
- **A gap can't be reproduced.** Ask the tester to repeat the steps from a fresh session and record each step's screenshot.
- **The client disputes a gap.** Send the steps and the screenshot again. Offer to walk through it on a call.
- **You found something serious.** Stop testing that area. Tell the client privately the same day. Don't post about it.
