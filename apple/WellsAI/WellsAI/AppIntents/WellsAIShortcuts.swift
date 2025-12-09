import AppIntents

/// App Shortcuts Provider for WellsAI
/// Provides shortcuts for Spotlight and Shortcuts app
/// NO Siri phrases - per user request
struct WellsAIShortcuts: AppShortcutsProvider {
    /// Define the app shortcuts available
    /// Note: phrases array is empty - no Siri integration
    static var appShortcuts: [AppShortcut] {
        // Chat with AI shortcut
        AppShortcut(
            intent: ChatWithAIIntent(),
            phrases: [], // Empty - no Siri integration per user request
            shortTitle: "Chat with AI",
            systemImageName: "bubble.left.and.bubble.right"
        )

        // Quick question shortcut
        AppShortcut(
            intent: QuickQuestionIntent(),
            phrases: [],
            shortTitle: "Quick Question",
            systemImageName: "questionmark.bubble"
        )

        // Open app shortcut
        AppShortcut(
            intent: OpenWellsAIIntent(),
            phrases: [],
            shortTitle: "Open WellsAI",
            systemImageName: "app"
        )

        // New conversation shortcut
        AppShortcut(
            intent: StartNewConversationIntent(),
            phrases: [],
            shortTitle: "New Chat",
            systemImageName: "square.and.pencil"
        )
    }
}
