import AppIntents
import SwiftUI

// MARK: - Send Payment Intent

struct SendPaymentIntent: AppIntent {
    static var title: LocalizedStringResource = "Send Payment"
    static var description = IntentDescription("Send a payment to someone via Grain & Vault")

    @Parameter(title: "Recipient", description: "Email, phone, or username of the recipient")
    var recipient: String

    @Parameter(title: "Amount", description: "Amount in USD to send")
    var amount: Double

    @Parameter(title: "Note", description: "Optional note for the payment")
    var note: String?

    static var parameterSummary: some ParameterSummary {
        When(\.$note, .hasAnyValue) {
            Summary("Send \(\.$amount) to \(\.$recipient) for \(\.$note)")
        } otherwise: {
            Summary("Send \(\.$amount) to \(\.$recipient)")
        }
    }

    // Opens the app for confirmation (security requirement)
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        // For security, we don't actually send the payment here
        // Instead, we prepare it and require in-app confirmation with biometrics

        let amountDecimal = Decimal(amount)

        return .result(
            dialog: "Ready to send \(amountDecimal.formatted(.currency(code: "USD"))) to \(recipient). Please confirm in the app.",
            view: PaymentPreviewView(
                recipient: recipient,
                amount: amountDecimal,
                note: note
            )
        )
    }
}

struct PaymentPreviewView: View {
    let recipient: String
    let amount: Decimal
    let note: String?

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "arrow.up.circle.fill")
                .font(.system(size: 48))
                .foregroundColor(.blue)

            Text("Sending")
                .font(.caption)
                .foregroundColor(.secondary)

            Text(amount.formatted(.currency(code: "USD")))
                .font(.system(size: 36, weight: .bold, design: .rounded))

            Text("to \(recipient)")
                .font(.subheadline)

            if let note = note, !note.isEmpty {
                Text("\"\(note)\"")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .italic()
            }

            HStack {
                Image(systemName: "faceid")
                Text("Confirm with Face ID in app")
            }
            .font(.caption)
            .foregroundColor(.blue)
            .padding(.top, 8)
        }
        .padding()
    }
}

// MARK: - Request Payment Intent

struct RequestPaymentIntent: AppIntent {
    static var title: LocalizedStringResource = "Request Payment"
    static var description = IntentDescription("Request a payment from someone")

    @Parameter(title: "From", description: "Email, phone, or username to request from")
    var from: String

    @Parameter(title: "Amount", description: "Amount in USD to request")
    var amount: Double

    @Parameter(title: "Note", description: "What's this for?")
    var note: String?

    static var parameterSummary: some ParameterSummary {
        When(\.$note, .hasAnyValue) {
            Summary("Request \(\.$amount) from \(\.$from) for \(\.$note)")
        } otherwise: {
            Summary("Request \(\.$amount) from \(\.$from)")
        }
    }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        do {
            let _ = try await GrainVaultAPIClient.shared.requestPayment(
                from: from,
                amount: Decimal(amount),
                note: note
            )

            return .result(
                dialog: "Payment request for \(Decimal(amount).formatted(.currency(code: "USD"))) sent to \(from)."
            )
        } catch {
            return .result(
                dialog: "Could not send payment request. Please try again in the app."
            )
        }
    }
}

// MARK: - Recent Payments Intent

struct RecentPaymentsIntent: AppIntent {
    static var title: LocalizedStringResource = "Show Recent Payments"
    static var description = IntentDescription("View your recent payment activity")

    @Parameter(title: "Number of payments", default: 5)
    var limit: Int

    static var openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let response = try await GrainVaultAPIClient.shared.getTransactions(limit: limit)

        let count = response.transactions.count
        let total = response.transactions.reduce(Decimal.zero) { $0 + $1.amount }

        return .result(
            dialog: "You have \(count) recent transactions totaling \(total.formatted(.currency(code: "USD"))).",
            view: RecentPaymentsSnippetView(transactions: response.transactions)
        )
    }
}

struct RecentPaymentsSnippetView: View {
    let transactions: [GrainVaultAPIClient.TransactionDetail]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Recent Activity")
                .font(.headline)

            ForEach(transactions.prefix(5), id: \.id) { transaction in
                HStack {
                    Circle()
                        .fill(transaction.type == "received" ? Color.green.opacity(0.2) : Color.blue.opacity(0.2))
                        .frame(width: 32, height: 32)
                        .overlay {
                            Image(systemName: transaction.type == "received" ? "arrow.down" : "arrow.up")
                                .font(.caption)
                                .foregroundColor(transaction.type == "received" ? .green : .blue)
                        }

                    VStack(alignment: .leading) {
                        Text(transaction.recipient ?? transaction.sender ?? "Unknown")
                            .font(.caption)
                            .lineLimit(1)

                        if let note = transaction.note {
                            Text(note)
                                .font(.caption2)
                                .foregroundColor(.secondary)
                                .lineLimit(1)
                        }
                    }

                    Spacer()

                    Text(transaction.type == "received" ? "+\(transaction.amount.formatted(.currency(code: "USD")))" : "-\(transaction.amount.formatted(.currency(code: "USD")))")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(transaction.type == "received" ? .green : .primary)
                }
            }
        }
        .padding()
    }
}

// MARK: - Entity for Shortcuts

struct PaymentRecipientEntity: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Payment Recipient"
    static var defaultQuery = PaymentRecipientQuery()

    var id: String
    var displayName: String
    var identifier: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(displayName)", subtitle: "\(identifier)")
    }
}

struct PaymentRecipientQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [PaymentRecipientEntity] {
        // Look up recipients by ID
        return identifiers.compactMap { id in
            // In a real app, this would query the database
            PaymentRecipientEntity(id: id, displayName: "User", identifier: id)
        }
    }

    func suggestedEntities() async throws -> [PaymentRecipientEntity] {
        // Return recent recipients as suggestions
        // In a real app, this would fetch from the API
        return [
            PaymentRecipientEntity(id: "1", displayName: "John Doe", identifier: "john@example.com"),
            PaymentRecipientEntity(id: "2", displayName: "Sarah Smith", identifier: "+1234567890"),
        ]
    }
}
