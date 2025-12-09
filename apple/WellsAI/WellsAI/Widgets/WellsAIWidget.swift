import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Widget Entry

struct WellsAIWidgetEntry: TimelineEntry {
    let date: Date
    let lastConversationTitle: String?
    let lastConversationPreview: String?
    let configuration: WellsAIWidgetConfigurationIntent
}

// MARK: - Timeline Provider

struct WellsAIWidgetProvider: AppIntentTimelineProvider {
    typealias Entry = WellsAIWidgetEntry
    typealias Intent = WellsAIWidgetConfigurationIntent

    func placeholder(in context: Context) -> WellsAIWidgetEntry {
        WellsAIWidgetEntry(
            date: Date(),
            lastConversationTitle: "Recent Chat",
            lastConversationPreview: "Tap to start chatting with WellsAI",
            configuration: WellsAIWidgetConfigurationIntent()
        )
    }

    func snapshot(for configuration: WellsAIWidgetConfigurationIntent, in context: Context) async -> WellsAIWidgetEntry {
        WellsAIWidgetEntry(
            date: Date(),
            lastConversationTitle: "Market Analysis",
            lastConversationPreview: "Latest supply chain trends show...",
            configuration: configuration
        )
    }

    func timeline(for configuration: WellsAIWidgetConfigurationIntent, in context: Context) async -> Timeline<WellsAIWidgetEntry> {
        // Fetch latest conversation (in a real implementation)
        let entry = WellsAIWidgetEntry(
            date: Date(),
            lastConversationTitle: configuration.showRecentChat ? "Recent Chat" : nil,
            lastConversationPreview: configuration.showRecentChat ? "Tap to continue..." : nil,
            configuration: configuration
        )

        // Refresh every hour
        let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: Date())!
        return Timeline(entries: [entry], policy: .after(nextUpdate))
    }
}

// MARK: - Widget Configuration Intent

struct WellsAIWidgetConfigurationIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "WellsAI Widget"
    static var description = IntentDescription("Configure the WellsAI widget")

    @Parameter(title: "Show Recent Chat", default: true)
    var showRecentChat: Bool
}

// MARK: - Widget Views

struct WellsAIWidgetEntryView: View {
    var entry: WellsAIWidgetEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            SmallWidgetView(entry: entry)
        case .systemMedium:
            MediumWidgetView(entry: entry)
        case .systemLarge:
            LargeWidgetView(entry: entry)
        default:
            SmallWidgetView(entry: entry)
        }
    }
}

struct SmallWidgetView: View {
    let entry: WellsAIWidgetEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "bubble.left.and.bubble.right.fill")
                    .font(.title2)
                    .foregroundStyle(.blue.gradient)

                Spacer()
            }

            Text("WellsAI")
                .font(.headline)
                .fontWeight(.semibold)

            Text("Tap to chat")
                .font(.caption)
                .foregroundColor(.secondary)

            Spacer()
        }
        .padding()
        .containerBackground(.fill.tertiary, for: .widget)
        .widgetURL(URL(string: "wellsai://chat"))
    }
}

struct MediumWidgetView: View {
    let entry: WellsAIWidgetEntry

    var body: some View {
        HStack(spacing: 16) {
            // Left side - Logo and CTA
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: "bubble.left.and.bubble.right.fill")
                    .font(.largeTitle)
                    .foregroundStyle(.blue.gradient)

                Text("WellsAI")
                    .font(.headline)

                Text("AI Commerce Assistant")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Spacer()

                Link(destination: URL(string: "wellsai://chat")!) {
                    Label("Start Chat", systemImage: "arrow.right.circle.fill")
                        .font(.caption)
                        .foregroundColor(.blue)
                }
            }

            Divider()

            // Right side - Recent conversation
            VStack(alignment: .leading, spacing: 4) {
                if let title = entry.lastConversationTitle {
                    Text(title)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .lineLimit(1)

                    if let preview = entry.lastConversationPreview {
                        Text(preview)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .lineLimit(3)
                    }
                } else {
                    Text("No recent chats")
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    Text("Start a conversation to see it here")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding()
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

struct LargeWidgetView: View {
    let entry: WellsAIWidgetEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Image(systemName: "bubble.left.and.bubble.right.fill")
                    .font(.title)
                    .foregroundStyle(.blue.gradient)

                VStack(alignment: .leading) {
                    Text("WellsAI")
                        .font(.headline)
                    Text("AI Commerce Assistant")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                Link(destination: URL(string: "wellsai://chat/new")!) {
                    Image(systemName: "square.and.pencil")
                        .font(.title2)
                        .foregroundColor(.blue)
                }
            }

            Divider()

            // Quick Actions
            Text("Quick Actions")
                .font(.caption)
                .foregroundColor(.secondary)

            HStack(spacing: 12) {
                QuickActionButton(title: "Market Update", icon: "chart.line.uptrend.xyaxis", urlString: "wellsai://chat?prompt=market")
                QuickActionButton(title: "Negotiation", icon: "person.2", urlString: "wellsai://chat?prompt=negotiate")
            }

            HStack(spacing: 12) {
                QuickActionButton(title: "Supply Chain", icon: "shippingbox", urlString: "wellsai://chat?prompt=supply")
                QuickActionButton(title: "Pricing", icon: "dollarsign.circle", urlString: "wellsai://chat?prompt=pricing")
            }

            Spacer()

            // Recent chat
            if let title = entry.lastConversationTitle {
                Divider()
                VStack(alignment: .leading, spacing: 4) {
                    Text("Recent")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Text(title)
                        .font(.subheadline)
                        .lineLimit(1)

                    if let preview = entry.lastConversationPreview {
                        Text(preview)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .lineLimit(2)
                    }
                }
            }
        }
        .padding()
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

struct QuickActionButton: View {
    let title: String
    let icon: String
    let urlString: String

    var body: some View {
        Link(destination: URL(string: urlString)!) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.title3)
                Text(title)
                    .font(.caption2)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(Color.blue.opacity(0.1))
            .cornerRadius(8)
        }
        .foregroundColor(.blue)
    }
}

// MARK: - Widget Definition

struct WellsAIWidget: Widget {
    let kind: String = "WellsAIWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: kind,
            intent: WellsAIWidgetConfigurationIntent.self,
            provider: WellsAIWidgetProvider()
        ) { entry in
            WellsAIWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("WellsAI")
        .description("Quick access to WellsAI chat")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

// MARK: - Widget Bundle

@main
struct WellsAIWidgetBundle: WidgetBundle {
    var body: some Widget {
        WellsAIWidget()
    }
}

// MARK: - Previews

#Preview("Small", as: .systemSmall) {
    WellsAIWidget()
} timeline: {
    WellsAIWidgetEntry(
        date: Date(),
        lastConversationTitle: "Market Analysis",
        lastConversationPreview: "Latest trends...",
        configuration: WellsAIWidgetConfigurationIntent()
    )
}

#Preview("Medium", as: .systemMedium) {
    WellsAIWidget()
} timeline: {
    WellsAIWidgetEntry(
        date: Date(),
        lastConversationTitle: "Supplier Negotiation",
        lastConversationPreview: "Here are some tips for negotiating better terms with your suppliers...",
        configuration: WellsAIWidgetConfigurationIntent()
    )
}

#Preview("Large", as: .systemLarge) {
    WellsAIWidget()
} timeline: {
    WellsAIWidgetEntry(
        date: Date(),
        lastConversationTitle: "Q4 Planning",
        lastConversationPreview: "Based on current market conditions, here's what I recommend...",
        configuration: WellsAIWidgetConfigurationIntent()
    )
}
