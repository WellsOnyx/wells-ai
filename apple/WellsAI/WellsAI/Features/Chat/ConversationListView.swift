import SwiftUI
import SwiftData

struct ConversationListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Conversation.updatedAt, order: .reverse) private var conversations: [Conversation]

    @State private var searchText = ""
    @State private var isLoading = false
    @State private var serverConversations: [ConversationSummary] = []

    var filteredConversations: [Conversation] {
        if searchText.isEmpty {
            return conversations
        }
        return conversations.filter { conversation in
            conversation.title.localizedCaseInsensitiveContains(searchText) ||
            conversation.sortedMessages.contains { $0.content.localizedCaseInsensitiveContains(searchText) }
        }
    }

    var body: some View {
        NavigationStack {
            List {
                if isLoading {
                    HStack {
                        Spacer()
                        ProgressView()
                        Spacer()
                    }
                }

                ForEach(filteredConversations) { conversation in
                    NavigationLink(value: conversation) {
                        ConversationRow(conversation: conversation)
                    }
                }
                .onDelete(perform: deleteConversations)
            }
            .navigationTitle("History")
            .searchable(text: $searchText, prompt: "Search conversations")
            .refreshable {
                await loadFromServer()
            }
            .navigationDestination(for: Conversation.self) { conversation in
                ConversationDetailView(conversation: conversation)
            }
            .toolbar {
                #if os(iOS)
                EditButton()
                #endif
            }
            .overlay {
                if conversations.isEmpty && !isLoading {
                    ContentUnavailableView(
                        "No Conversations",
                        systemImage: "bubble.left.and.bubble.right",
                        description: Text("Start a chat to see your conversation history here")
                    )
                }
            }
        }
        .task {
            await loadFromServer()
        }
    }

    private func deleteConversations(at offsets: IndexSet) {
        for index in offsets {
            let conversation = filteredConversations[index]
            modelContext.delete(conversation)
        }
    }

    private func loadFromServer() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let response = try await WellsAPIClient.shared.listConversations()
            serverConversations = response.conversations

            // Sync with local storage
            for summary in response.conversations {
                let fetchDescriptor = FetchDescriptor<Conversation>(
                    predicate: #Predicate { $0.serverId == summary.id }
                )

                if (try? modelContext.fetch(fetchDescriptor).first) == nil {
                    let conversation = Conversation(
                        serverId: summary.id,
                        title: summary.title ?? "Conversation",
                        createdAt: ISO8601DateFormatter().date(from: summary.createdAt) ?? Date(),
                        updatedAt: ISO8601DateFormatter().date(from: summary.updatedAt) ?? Date()
                    )
                    modelContext.insert(conversation)
                }
            }

            try? modelContext.save()
        } catch {
            // Silent fail - local conversations still available
            print("Failed to load from server: \(error)")
        }
    }
}

struct ConversationRow: View {
    let conversation: Conversation

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(conversation.title)
                .font(.headline)
                .lineLimit(1)

            if let preview = conversation.preview {
                Text(preview)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }

            HStack {
                Text(conversation.updatedAt.formatted(.relative(presentation: .named)))
                    .font(.caption)
                    .foregroundColor(.secondary)

                Spacer()

                Text("\(conversation.messages.count) messages")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

struct ConversationDetailView: View {
    @StateObject private var viewModel = ChatViewModel()
    let conversation: Conversation

    var body: some View {
        ChatView()
            .onAppear {
                viewModel.loadConversation(conversation)
            }
    }
}

#Preview {
    ConversationListView()
        .modelContainer(for: [Conversation.self, ChatMessage.self], inMemory: true)
}
