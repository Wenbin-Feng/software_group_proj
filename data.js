window.ReviewRoomData = {
  scenarios: [
    {
      id: "pr-review",
      icon: "PR",
      category: "Code review",
      title: "Explain a risky pull request",
      duration: "8 min",
      level: "Foundation",
      description: "Practise giving specific, respectful feedback when a teammate's change may fail in production.",
      goal: "Explain the risk, ask a useful question, and propose a safe next step.",
      questions: [
        "You notice that a pull request catches every error and returns an empty result. How would you begin your review comment?",
        "The author replies: ‘It keeps the user experience smooth.’ How would you explain the trade-off?",
        "Finish the conversation by suggesting one concrete change and one test."
      ],
      feedback: [
        "Good start. You focused on the behaviour rather than blaming the author.",
        "You identified the trade-off. Add a concrete example of a hidden production failure.",
        "Clear next step. Naming the expected test makes the feedback actionable."
      ]
    },
    {
      id: "sprint-scope",
      icon: "SP",
      category: "Team conversation",
      title: "Negotiate sprint scope",
      duration: "6 min",
      level: "Foundation",
      description: "Respond to a product owner when the sprint has more work than the team can safely finish.",
      goal: "Clarify priority, communicate uncertainty, and agree on a smaller outcome.",
      questions: [
        "The product owner asks the team to add two urgent features halfway through the sprint. What do you say first?",
        "They answer that both features are essential. What evidence or options would you present?",
        "Summarise an agreement that protects quality and keeps one valuable outcome."
      ],
      feedback: [
        "You opened with clarification instead of rejecting the request.",
        "Useful options. Try to mention the impact on testing and the sprint goal.",
        "The agreement is measurable and gives the stakeholder a real choice."
      ]
    },
    {
      id: "ai-decision",
      icon: "AI",
      category: "AI fluency",
      title: "Defend an AI-assisted decision",
      duration: "7 min",
      level: "Intermediate",
      description: "Explain what was delegated to AI, what was checked by a human, and what evidence supports the result.",
      goal: "Use the 4D AI Fluency language without hiding behind the tool.",
      questions: [
        "A teammate asks whether the generated validation code can be trusted. How do you answer?",
        "Describe one check you would perform before accepting the generated code.",
        "How would you document the final human decision and the AI contribution?"
      ],
      feedback: [
        "You separated AI assistance from human accountability.",
        "That check is relevant. State what result would cause you to reject the output.",
        "Good documentation idea. It makes the reasoning visible to the team."
      ]
    }
  ],
  reviewChallenges: [
    {
      id: "silent-error",
      line: 6,
      label: "Silent failure",
      explanation: "The catch block hides the failure and makes an unavailable service look like an empty course list.",
      suggestion: "Return an explicit error state or rethrow a typed error, then test both timeout and server-error cases."
    },
    {
      id: "missing-status",
      line: 3,
      label: "HTTP status is ignored",
      explanation: "fetch resolves for HTTP 404 and 500 responses. Parsing JSON does not prove that the request succeeded.",
      suggestion: "Check response.ok before parsing the body and preserve a useful error message."
    },
    {
      id: "weak-contract",
      line: 4,
      label: "Response shape is trusted",
      explanation: "The function assumes the server always returns an object with a courses array.",
      suggestion: "Validate the returned shape or give the caller a typed result with loading, data and error states."
    }
  ]
};

