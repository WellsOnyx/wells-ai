import Foundation
import SwiftData

@Model
final class Conversation {
    @Attribute(.unique) var id: UUID
    var serverId: String?
    var title: String
    var createdAt: Date
    var updatedAt: Date

    @Relationship(deleteRule: .cascade, inverse: \ChatMessage.conversation)
    var messages: [ChatMessage] = []

    init(
        id: UUID = UUID(),
        serverId: String? = nil,
        title: String = "New Chat",
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.serverId = serverId
        self.title = title
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    /// Generate a title from the first user message
    func generateTitle(from firstMessage: String) {
        let maxLength = 50
        if firstMessage.count > maxLength {
            self.title = String(firstMessage.prefix(maxLength)) + "..."
        } else {
            self.title = firstMessage
        }
    }

    /// Get sorted messages
    var sortedMessages: [ChatMessage] {
        messages.sorted { $0.timestamp < $1.timestamp }
    }

    /// Get the last message preview
    var preview: String? {
        sortedMessages.last?.content
    }
}

@Model
final class ChatMessage {
    @Attribute(.unique) var id: UUID
    var serverId: String?
    var role: MessageRole
    var content: String
    var timestamp: Date
    var isStreaming: Bool

    var conversation: Conversation?

    init(
        id: UUID = UUID(),
        serverId: String? = nil,
        role: MessageRole,
        content: String,
        timestamp: Date = Date(),
        isStreaming: Bool = false
    ) {
        self.id = id
        self.serverId = serverId
        self.role = role
        self.content = content
        self.timestamp = timestamp
        self.isStreaming = isStreaming
    }
}

enum MessageRole: String, Codable {
    case user
    case assistant
    case system

    var displayName: String {
        switch self {
        case .user:
            return "You"
        case .assistant:
            return "WellsAI"
        case .system:
            return "System"
        }
    }
}
