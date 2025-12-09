import AppIntents
import SwiftUI

// MARK: - Check Balance Intent

struct CheckBalanceIntent: AppIntent {
    static var title: LocalizedStringResource = "Check Balance"
    static var description = IntentDescription("Check your Grain & Vault balance")

    static var openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let balance = try await GrainVaultAPIClient.shared.getBalance()

        let grainFormatted = balance.grainBalance.formatted(.currency(code: "USD"))
        let creditAvailable = balance.creditAvailable?.formatted(.currency(code: "USD")) ?? "$0.00"

        return .result(
            dialog: "Your GRAIN balance is \(grainFormatted) with \(creditAvailable) credit available.",
            view: BalanceSnippetView(balance: balance)
        )
    }
}

struct BalanceSnippetView: View {
    let balance: GrainVaultAPIClient.BalanceResponse

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Image(systemName: "building.columns.fill")
                    .font(.title2)
                    .foregroundColor(.green)

                Text("Grain & Vault")
                    .font(.headline)
            }

            VStack(spacing: 4) {
                Text("GRAIN Balance")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Text(balance.grainBalance.formatted(.currency(code: "USD")))
                    .font(.system(size: 32, weight: .bold, design: .rounded))
            }

            HStack(spacing: 24) {
                VStack {
                    Text("Credit Available")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    Text(balance.creditAvailable?.formatted(.currency(code: "USD")) ?? "$0.00")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.blue)
                }

                VStack {
                    Text("APY")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    Text("\(balance.appreciationRate, specifier: "%.1f")%")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.green)
                }
            }
        }
        .padding()
    }
}

// MARK: - Check Credit Intent

struct CheckCreditIntent: AppIntent {
    static var title: LocalizedStringResource = "Check Credit Line"
    static var description = IntentDescription("Check your credit line status")

    static var openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let creditLine = try await GrainVaultAPIClient.shared.getCreditLine()

        let available = (creditLine.limit - creditLine.used).formatted(.currency(code: "USD"))
        let utilization = Int((creditLine.used / creditLine.limit) * 100)

        return .result(
            dialog: "You have \(available) available credit. Your utilization is \(utilization)%.",
            view: CreditSnippetView(creditLine: creditLine)
        )
    }
}

struct CreditSnippetView: View {
    let creditLine: GrainVaultAPIClient.CreditLineResponse

    var utilization: Double {
        Double(truncating: (creditLine.used / creditLine.limit) as NSNumber)
    }

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Image(systemName: "creditcard.fill")
                    .font(.title2)
                    .foregroundColor(.blue)

                Text("Credit Line")
                    .font(.headline)
            }

            VStack(spacing: 4) {
                Text("Available Credit")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Text((creditLine.limit - creditLine.used).formatted(.currency(code: "USD")))
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundColor(.blue)
            }

            // Utilization bar
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.gray.opacity(0.2))

                    RoundedRectangle(cornerRadius: 4)
                        .fill(utilizationColor.gradient)
                        .frame(width: geometry.size.width * utilization)
                }
            }
            .frame(height: 8)

            HStack {
                Text("Used: \(creditLine.used.formatted(.currency(code: "USD")))")
                    .font(.caption2)
                    .foregroundColor(.secondary)

                Spacer()

                Text("Limit: \(creditLine.limit.formatted(.currency(code: "USD")))")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            Text("\(creditLine.apr, specifier: "%.1f")% APR")
                .font(.caption)
                .foregroundColor(.purple)
        }
        .padding()
    }

    private var utilizationColor: Color {
        if utilization < 0.3 {
            return .green
        } else if utilization < 0.7 {
            return .yellow
        } else {
            return .red
        }
    }
}

// MARK: - Quick Actions

struct QuickDrawIntent: AppIntent {
    static var title: LocalizedStringResource = "Draw Funds"
    static var description = IntentDescription("Draw funds from your credit line")

    @Parameter(title: "Amount", description: "Amount to draw", requestValueDialog: "How much would you like to draw?")
    var amount: Double

    static var parameterSummary: some ParameterSummary {
        Summary("Draw \(\.$amount) from credit line")
    }

    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult & OpensIntent {
        // Open the app to the draw funds view with the amount pre-filled
        return .result(opensIntent: OpenDrawFundsIntent(amount: amount))
    }
}

struct OpenDrawFundsIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Draw Funds"
    static var description = IntentDescription("Open the draw funds screen")

    @Parameter(title: "Amount")
    var amount: Double?

    init() {}

    init(amount: Double) {
        self.amount = amount
    }

    func perform() async throws -> some IntentResult {
        // The app will handle opening to the correct view
        return .result()
    }
}
