import Foundation
import SwiftData
import Combine

@MainActor
final class ChatViewModel: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var isStreaming = false
    @Published var error: String?

    var modelContext: ModelContext?

    private var currentConversation: Conversation?
    private var streamingMessage: ChatMessage?

    // MARK: - Public Methods

    func sendMessage(_ content: String) async {
        guard !content.isEmpty else { return }

        // Create user message
        let userMessage = ChatMessage(role: .user, content: content)
        messages.append(userMessage)

        // Create or get conversation
        if currentConversation == nil {
            let conversation = Conversation()
            conversation.generateTitle(from: content)
            currentConversation = conversation
            modelContext?.insert(conversation)
        }

        userMessage.conversation = currentConversation
        modelContext?.insert(userMessage)

        // Update conversation timestamp
        currentConversation?.updatedAt = Date()

        // Send to API and stream response
        isStreaming = true

        do {
            // Create placeholder for streaming response
            let assistantMessage = ChatMessage(role: .assistant, content: "", isStreaming: true)
            messages.append(assistantMessage)
            streamingMessage = assistantMessage

            // Stream the response
            let stream = WellsAPIClient.shared.streamMessage(
                content,
                conversationId: currentConversation?.serverId
            )

            var fullContent = ""

            for try await chunk in stream {
                if let text = chunk.content {
                    fullContent += text
                    assistantMessage.content = fullContent

                    // Update UI
                    if let index = messages.firstIndex(where: { $0.id == assistantMessage.id }) {
                        messages[index] = assistantMessage
                    }
                }

                // Store conversation ID from server
                if let serverId = chunk.conversationId {
                    currentConversation?.serverId = serverId
                }
            }

            // Finalize message
            assistantMessage.isStreaming = false
            assistantMessage.conversation = currentConversation
            modelContext?.insert(assistantMessage)

            try? modelContext?.save()

        } catch {
            self.error = error.localizedDescription

            // Remove streaming message on error
            if let streamingMsg = streamingMessage,
               let index = messages.firstIndex(where: { $0.id == streamingMsg.id }) {
                messages.remove(at: index)
            }
        }

        isStreaming = false
        streamingMessage = nil
    }

    func startNewConversation() {
        messages = []
        currentConversation = nil
    }

    func loadConversation(_ conversation: Conversation) {
        currentConversation = conversation
        messages = conversation.sortedMessages
    }

    func loadConversation(id: String) async {
        do {
            let detail = try await WellsAPIClient.shared.getConversation(id: id)

            // Find or create local conversation
            let fetchDescriptor = FetchDescriptor<Conversation>(
                predicate: #Predicate { $0.serverId == id }
            )

            if let existing = try? modelContext?.fetch(fetchDescriptor).first {
                currentConversation = existing
            } else {
                let conversation = Conversation(serverId: id)
                currentConversation = conversation
                modelContext?.insert(conversation)
            }

            // Load messages
            messages = detail.messages.map { response in
                ChatMessage(
                    serverId: response.id,
                    role: MessageRole(rawValue: response.role) ?? .assistant,
                    content: response.content,
                    timestamp: ISO8601DateFormatter().date(from: response.createdAt) ?? Date()
                )
            }

        } catch {
            self.error = error.localizedDescription
        }
    }
}
