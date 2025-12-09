import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Widget Bundle

@main
struct GrainVaultWidgetBundle: WidgetBundle {
    var body: some Widget {
        GrainBalanceWidget()
        CreditLineWidget()
        QuickActionsWidget()
    }
}

// MARK: - Timeline Provider

struct GrainVaultProvider: AppIntentTimelineProvider {
    typealias Entry = GrainVaultEntry
    typealias Intent = GrainVaultWidgetConfigurationIntent

    func placeholder(in context: Context) -> GrainVaultEntry {
        GrainVaultEntry(
            date: Date(),
            grainBalance: 12543.87,
            usdEquivalent: 12543.87,
            appreciationRate: 4.5,
            creditLimit: 50000,
            creditUsed: 12500,
            creditAPR: 8.5,
            configuration: GrainVaultWidgetConfigurationIntent()
        )
    }

    func snapshot(for configuration: GrainVaultWidgetConfigurationIntent, in context: Context) async -> GrainVaultEntry {
        await fetchEntry(for: configuration)
    }

    func timeline(for configuration: GrainVaultWidgetConfigurationIntent, in context: Context) async -> Timeline<GrainVaultEntry> {
        let entry = await fetchEntry(for: configuration)

        // Refresh every 15 minutes
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!

        return Timeline(entries: [entry], policy: .after(nextUpdate))
    }

    private func fetchEntry(for configuration: GrainVaultWidgetConfigurationIntent) async -> GrainVaultEntry {
        do {
            let balance = try await GrainVaultAPIClient.shared.getBalance()
            let creditLine = try await GrainVaultAPIClient.shared.getCreditLine()

            return GrainVaultEntry(
                date: Date(),
                grainBalance: balance.grainBalance,
                usdEquivalent: balance.usdEquivalent,
                appreciationRate: balance.appreciationRate,
                creditLimit: creditLine.limit,
                creditUsed: creditLine.used,
                creditAPR: creditLine.apr,
                configuration: configuration
            )
        } catch {
            // Return cached/placeholder data
            return GrainVaultEntry(
                date: Date(),
                grainBalance: 12543.87,
                usdEquivalent: 12543.87,
                appreciationRate: 4.5,
                creditLimit: 50000,
                creditUsed: 12500,
                creditAPR: 8.5,
                configuration: configuration
            )
        }
    }
}

// MARK: - Widget Entry

struct GrainVaultEntry: TimelineEntry {
    let date: Date
    let grainBalance: Decimal
    let usdEquivalent: Decimal
    let appreciationRate: Double
    let creditLimit: Decimal
    let creditUsed: Decimal
    let creditAPR: Double
    let configuration: GrainVaultWidgetConfigurationIntent

    var creditAvailable: Decimal {
        creditLimit - creditUsed
    }

    var creditUtilization: Double {
        guard creditLimit > 0 else { return 0 }
        return Double(truncating: (creditUsed / creditLimit) as NSNumber)
    }
}

// MARK: - Widget Configuration Intent

struct GrainVaultWidgetConfigurationIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Configure Widget"
    static var description = IntentDescription("Configure your Grain & Vault widget")

    @Parameter(title: "Show Credit Info", default: true)
    var showCreditInfo: Bool

    @Parameter(title: "Show APY", default: true)
    var showAPY: Bool
}

// MARK: - Balance Widget

struct GrainBalanceWidget: Widget {
    let kind: String = "GrainBalanceWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: kind,
            intent: GrainVaultWidgetConfigurationIntent.self,
            provider: GrainVaultProvider()
        ) { entry in
            GrainBalanceWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("GRAIN Balance")
        .description("View your current GRAIN balance")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryCircular])
    }
}

struct GrainBalanceWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: GrainVaultEntry

    var body: some View {
        switch family {
        case .systemSmall:
            SmallBalanceView(entry: entry)
        case .systemMedium:
            MediumBalanceView(entry: entry)
        case .accessoryRectangular:
            RectangularBalanceView(entry: entry)
        case .accessoryCircular:
            CircularBalanceView(entry: entry)
        default:
            SmallBalanceView(entry: entry)
        }
    }
}

struct SmallBalanceView: View {
    let entry: GrainVaultEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "building.columns.fill")
                    .foregroundColor(.green)
                Text("GRAIN")
                    .font(.caption)
                    .fontWeight(.semibold)
            }

            Spacer()

            Text(entry.grainBalance.formatted(.currency(code: "USD")))
                .font(.system(size: 24, weight: .bold, design: .rounded))
                .minimumScaleFactor(0.5)

            if entry.configuration.showAPY {
                HStack(spacing: 4) {
                    Image(systemName: "arrow.up.right")
                        .font(.caption2)
                    Text("\(entry.appreciationRate, specifier: "%.1f")% APY")
                        .font(.caption2)
                }
                .foregroundColor(.green)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct MediumBalanceView: View {
    let entry: GrainVaultEntry

    var body: some View {
        HStack(spacing: 16) {
            // Balance section
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: "building.columns.fill")
                        .foregroundColor(.green)
                    Text("GRAIN Balance")
                        .font(.caption)
                }

                Text(entry.grainBalance.formatted(.currency(code: "USD")))
                    .font(.system(size: 28, weight: .bold, design: .rounded))

                if entry.configuration.showAPY {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.up.right")
                            .font(.caption2)
                        Text("\(entry.appreciationRate, specifier: "%.1f")% APY")
                            .font(.caption2)
                    }
                    .foregroundColor(.green)
                }
            }

            if entry.configuration.showCreditInfo {
                Divider()

                // Credit section
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Image(systemName: "creditcard.fill")
                            .foregroundColor(.blue)
                        Text("Credit")
                            .font(.caption)
                    }

                    Text(entry.creditAvailable.formatted(.currency(code: "USD")))
                        .font(.system(size: 20, weight: .bold, design: .rounded))
                        .foregroundColor(.blue)

                    Text("available")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct RectangularBalanceView: View {
    let entry: GrainVaultEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Image(systemName: "building.columns.fill")
                Text("GRAIN")
                    .fontWeight(.semibold)
            }
            .font(.caption2)

            Text(entry.grainBalance.formatted(.currency(code: "USD")))
                .font(.system(.title3, design: .rounded))
                .fontWeight(.bold)
        }
    }
}

struct CircularBalanceView: View {
    let entry: GrainVaultEntry

    var body: some View {
        VStack(spacing: 2) {
            Image(systemName: "building.columns.fill")
                .font(.caption)

            Text(formatCompact(entry.grainBalance))
                .font(.system(.body, design: .rounded))
                .fontWeight(.bold)
        }
    }

    private func formatCompact(_ value: Decimal) -> String {
        let number = NSDecimalNumber(decimal: value).doubleValue
        if number >= 1000 {
            return "$\(Int(number / 1000))K"
        }
        return "$\(Int(number))"
    }
}

// MARK: - Credit Line Widget

struct CreditLineWidget: Widget {
    let kind: String = "CreditLineWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: kind,
            intent: GrainVaultWidgetConfigurationIntent.self,
            provider: GrainVaultProvider()
        ) { entry in
            CreditLineWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Credit Line")
        .description("View your credit line status")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct CreditLineWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: GrainVaultEntry

    var body: some View {
        switch family {
        case .systemSmall:
            SmallCreditView(entry: entry)
        case .systemMedium:
            MediumCreditView(entry: entry)
        default:
            SmallCreditView(entry: entry)
        }
    }
}

struct SmallCreditView: View {
    let entry: GrainVaultEntry

    var utilizationColor: Color {
        if entry.creditUtilization < 0.3 {
            return .green
        } else if entry.creditUtilization < 0.7 {
            return .yellow
        } else {
            return .red
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "creditcard.fill")
                    .foregroundColor(.blue)
                Text("Credit")
                    .font(.caption)
                    .fontWeight(.semibold)
            }

            Spacer()

            Text(entry.creditAvailable.formatted(.currency(code: "USD")))
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundColor(.blue)

            Text("available")
                .font(.caption2)
                .foregroundColor(.secondary)

            // Utilization bar
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.gray.opacity(0.3))

                    RoundedRectangle(cornerRadius: 4)
                        .fill(utilizationColor.gradient)
                        .frame(width: geometry.size.width * entry.creditUtilization)
                }
            }
            .frame(height: 6)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct MediumCreditView: View {
    let entry: GrainVaultEntry

    var utilizationColor: Color {
        if entry.creditUtilization < 0.3 {
            return .green
        } else if entry.creditUtilization < 0.7 {
            return .yellow
        } else {
            return .red
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "creditcard.fill")
                    .foregroundColor(.blue)
                Text("Credit Line")
                    .font(.headline)

                Spacer()

                Text("\(entry.creditAPR, specifier: "%.1f")% APR")
                    .font(.caption)
                    .foregroundColor(.purple)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.purple.opacity(0.1))
                    .cornerRadius(8)
            }

            HStack(alignment: .bottom) {
                VStack(alignment: .leading) {
                    Text("Available")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(entry.creditAvailable.formatted(.currency(code: "USD")))
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                        .foregroundColor(.blue)
                }

                Spacer()

                VStack(alignment: .trailing) {
                    Text("Used")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(entry.creditUsed.formatted(.currency(code: "USD")))
                        .font(.subheadline)
                        .fontWeight(.semibold)
                }
            }

            // Utilization bar
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.gray.opacity(0.3))

                    RoundedRectangle(cornerRadius: 4)
                        .fill(utilizationColor.gradient)
                        .frame(width: geometry.size.width * entry.creditUtilization)
                }
            }
            .frame(height: 8)

            HStack {
                Text("\(Int(entry.creditUtilization * 100))% used")
                    .font(.caption2)
                    .foregroundColor(.secondary)

                Spacer()

                Text("Limit: \(entry.creditLimit.formatted(.currency(code: "USD")))")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
    }
}

// MARK: - Quick Actions Widget

struct QuickActionsWidget: Widget {
    let kind: String = "QuickActionsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QuickActionsProvider()) { entry in
            QuickActionsWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Quick Actions")
        .description("Quick access to common actions")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct QuickActionsProvider: TimelineProvider {
    func placeholder(in context: Context) -> QuickActionsEntry {
        QuickActionsEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (QuickActionsEntry) -> Void) {
        completion(QuickActionsEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<QuickActionsEntry>) -> Void) {
        let entry = QuickActionsEntry(date: Date())
        let timeline = Timeline(entries: [entry], policy: .never)
        completion(timeline)
    }
}

struct QuickActionsEntry: TimelineEntry {
    let date: Date
}

struct QuickActionsWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: QuickActionsEntry

    var body: some View {
        switch family {
        case .systemSmall:
            SmallQuickActionsView()
        case .systemMedium:
            MediumQuickActionsView()
        default:
            SmallQuickActionsView()
        }
    }
}

struct SmallQuickActionsView: View {
    var body: some View {
        VStack(spacing: 8) {
            Link(destination: URL(string: "grainvault://send")!) {
                HStack {
                    Image(systemName: "arrow.up.circle.fill")
                        .foregroundColor(.blue)
                    Text("Send")
                        .font(.subheadline)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color.blue.opacity(0.1))
                .cornerRadius(8)
            }

            Link(destination: URL(string: "grainvault://request")!) {
                HStack {
                    Image(systemName: "arrow.down.circle.fill")
                        .foregroundColor(.green)
                    Text("Request")
                        .font(.subheadline)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color.green.opacity(0.1))
                .cornerRadius(8)
            }
        }
    }
}

struct MediumQuickActionsView: View {
    var body: some View {
        HStack(spacing: 12) {
            Link(destination: URL(string: "grainvault://send")!) {
                VStack(spacing: 8) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title)
                        .foregroundColor(.blue)
                    Text("Send")
                        .font(.subheadline)
                        .fontWeight(.medium)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.blue.opacity(0.1))
                .cornerRadius(12)
            }

            Link(destination: URL(string: "grainvault://request")!) {
                VStack(spacing: 8) {
                    Image(systemName: "arrow.down.circle.fill")
                        .font(.title)
                        .foregroundColor(.green)
                    Text("Request")
                        .font(.subheadline)
                        .fontWeight(.medium)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.green.opacity(0.1))
                .cornerRadius(12)
            }

            Link(destination: URL(string: "grainvault://credit/draw")!) {
                VStack(spacing: 8) {
                    Image(systemName: "plus.circle.fill")
                        .font(.title)
                        .foregroundColor(.purple)
                    Text("Draw")
                        .font(.subheadline)
                        .fontWeight(.medium)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.purple.opacity(0.1))
                .cornerRadius(12)
            }
        }
    }
}

// MARK: - Widget Previews

#Preview("Small Balance", as: .systemSmall) {
    GrainBalanceWidget()
} timeline: {
    GrainVaultEntry(
        date: Date(),
        grainBalance: 12543.87,
        usdEquivalent: 12543.87,
        appreciationRate: 4.5,
        creditLimit: 50000,
        creditUsed: 12500,
        creditAPR: 8.5,
        configuration: GrainVaultWidgetConfigurationIntent()
    )
}

#Preview("Medium Balance", as: .systemMedium) {
    GrainBalanceWidget()
} timeline: {
    GrainVaultEntry(
        date: Date(),
        grainBalance: 12543.87,
        usdEquivalent: 12543.87,
        appreciationRate: 4.5,
        creditLimit: 50000,
        creditUsed: 12500,
        creditAPR: 8.5,
        configuration: GrainVaultWidgetConfigurationIntent()
    )
}

#Preview("Credit Widget", as: .systemMedium) {
    CreditLineWidget()
} timeline: {
    GrainVaultEntry(
        date: Date(),
        grainBalance: 12543.87,
        usdEquivalent: 12543.87,
        appreciationRate: 4.5,
        creditLimit: 50000,
        creditUsed: 12500,
        creditAPR: 8.5,
        configuration: GrainVaultWidgetConfigurationIntent()
    )
}
