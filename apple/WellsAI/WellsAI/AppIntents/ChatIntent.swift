import AppIntents
import SwiftUI

/// App Intent for chatting with WellsAI from Spotlight, Shortcuts, or widgets
/// NO Siri integration per user request - only Spotlight and Shortcuts
struct ChatWithAIIntent: AppIntent {
    static var title: LocalizedStringResource = "Chat with WellsAI"
    static var description = IntentDescription("Send a message to WellsAI and get an AI response")

    /// Opens the app after completion to show full response
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Message", description: "What would you like to ask WellsAI?")
    var message: String

    static var parameterSummary: some ParameterSummary {
        Summary("Ask WellsAI: \(\.$message)")
    }

    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        // Ensure user is authenticated
        guard AuthManager.shared.accessToken != nil else {
            return .result(
                value: "Please sign in to WellsAI first",
                dialog: IntentDialog("Please open WellsAI and sign in to use this feature.")
            )
        }

        do {
            // Send message to API
            let response = try await WellsAPIClient.shared.sendMessage(message)

            return .result(
                value: response.response,
                dialog: IntentDialog(stringLiteral: response.response)
            )
        } catch {
            return .result(
                value: "Error: \(error.localizedDescription)",
                dialog: IntentDialog("Sorry, I couldn't process your request. Please try again.")
            )
        }
    }
}

/// Quick question intent with preset questions
struct QuickQuestionIntent: AppIntent {
    static var title: LocalizedStringResource = "Ask WellsAI a Quick Question"
    static var description = IntentDescription("Get quick answers to common business questions")

    @Parameter(title: "Question Type")
    var questionType: QuickQuestionType

    static var parameterSummary: some ParameterSummary {
        Summary("Quick question: \(\.$questionType)")
    }

    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        guard AuthManager.shared.accessToken != nil else {
            return .result(
                value: "Please sign in first",
                dialog: IntentDialog("Please open WellsAI and sign in to use this feature.")
            )
        }

        let question = questionType.fullQuestion

        do {
            let response = try await WellsAPIClient.shared.sendMessage(question)
            return .result(
                value: response.response,
                dialog: IntentDialog(stringLiteral: response.response)
            )
        } catch {
            return .result(
                value: "Error: \(error.localizedDescription)",
                dialog: IntentDialog("Sorry, I couldn't process your request.")
            )
        }
    }
}

/// Enum for quick question types
enum QuickQuestionType: String, AppEnum {
    case marketUpdate = "market_update"
    case supplyChain = "supply_chain"
    case negotiation = "negotiation"
    case pricing = "pricing"

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Question Type"

    static var caseDisplayRepresentations: [QuickQuestionType: DisplayRepresentation] = [
        .marketUpdate: "Market Update",
        .supplyChain: "Supply Chain Tips",
        .negotiation: "Negotiation Help",
        .pricing: "Pricing Strategy"
    ]

    var fullQuestion: String {
        switch self {
        case .marketUpdate:
            return "What are the latest market trends I should know about for my business?"
        case .supplyChain:
            return "What are some best practices for optimizing my supply chain?"
        case .negotiation:
            return "Give me some negotiation tips for dealing with suppliers."
        case .pricing:
            return "How should I think about pricing strategy for my products?"
        }
    }
}

/// Open WellsAI app intent
struct OpenWellsAIIntent: AppIntent {
    static var title: LocalizedStringResource = "Open WellsAI"
    static var description = IntentDescription("Open the WellsAI app")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        return .result()
    }
}

/// Start new conversation intent
struct StartNewConversationIntent: AppIntent {
    static var title: LocalizedStringResource = "Start New Chat"
    static var description = IntentDescription("Start a new conversation with WellsAI")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        // The app will handle starting a new conversation when opened
        return .result()
    }
}
