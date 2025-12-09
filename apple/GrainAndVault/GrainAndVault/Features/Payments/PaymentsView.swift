import SwiftUI

struct PaymentsView: View {
    @State private var searchText = ""
    @StateObject private var viewModel = PaymentsViewModel()

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Action buttons
                HStack(spacing: 16) {
                    NavigationLink(destination: SendPaymentView()) {
                        ActionButton(title: "Send", icon: "arrow.up", color: .blue)
                    }

                    NavigationLink(destination: RequestPaymentView()) {
                        ActionButton(title: "Request", icon: "arrow.down", color: .green)
                    }
                }
                .padding()

                // Recent recipients
                VStack(alignment: .leading, spacing: 12) {
                    Text("Recent")
                        .font(.headline)
                        .padding(.horizontal)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 16) {
                            ForEach(viewModel.recentRecipients) { recipient in
                                NavigationLink(destination: SendPaymentView(prefilledRecipient: recipient)) {
                                    RecipientAvatar(recipient: recipient)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal)
                    }
                }
                .padding(.vertical)

                Divider()

                // Transaction history
                List {
                    ForEach(viewModel.groupedTransactions.keys.sorted().reversed(), id: \.self) { date in
                        Section(date.formatted(.dateTime.month().day().year())) {
                            ForEach(viewModel.groupedTransactions[date] ?? []) { transaction in
                                PaymentTransactionRow(transaction: transaction)
                            }
                        }
                    }
                }
                .listStyle(.plain)
            }
            .navigationTitle("Payments")
            .searchable(text: $searchText, prompt: "Search payments")
            .refreshable {
                await viewModel.refresh()
            }
            .task {
                await viewModel.loadData()
            }
        }
    }
}

struct ActionButton: View {
    let title: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title)
                .foregroundColor(.white)
                .frame(width: 60, height: 60)
                .background(color.gradient)
                .cornerRadius(30)

            Text(title)
                .font(.subheadline)
                .foregroundColor(.primary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(16)
    }
}

struct RecipientAvatar: View {
    let recipient: RecentRecipient

    var body: some View {
        VStack(spacing: 8) {
            Circle()
                .fill(Color.blue.gradient)
                .frame(width: 50, height: 50)
                .overlay {
                    Text(recipient.initials)
                        .font(.headline)
                        .foregroundColor(.white)
                }

            Text(recipient.name)
                .font(.caption)
                .foregroundColor(.primary)
                .lineLimit(1)
        }
        .frame(width: 70)
    }
}

struct PaymentTransactionRow: View {
    let transaction: Transaction

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(transaction.isIncoming ? Color.green.opacity(0.1) : Color.blue.opacity(0.1))
                .frame(width: 44, height: 44)
                .overlay {
                    Image(systemName: transaction.isIncoming ? "arrow.down" : "arrow.up")
                        .foregroundColor(transaction.isIncoming ? .green : .blue)
                }

            VStack(alignment: .leading, spacing: 2) {
                Text(transaction.recipientName ?? transaction.senderName ?? "Unknown")
                    .font(.subheadline)
                    .fontWeight(.medium)

                if let note = transaction.note {
                    Text(note)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(transaction.isIncoming ? "+\(transaction.displayAmount)" : "-\(transaction.displayAmount)")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(transaction.isIncoming ? .green : .primary)

                Text(transaction.createdAt.formatted(.dateTime.hour().minute()))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

@MainActor
class PaymentsViewModel: ObservableObject {
    @Published var transactions: [Transaction] = []
    @Published var recentRecipients: [RecentRecipient] = []
    @Published var isLoading = false

    var groupedTransactions: [Date: [Transaction]] {
        let calendar = Calendar.current
        return Dictionary(grouping: transactions) { transaction in
            calendar.startOfDay(for: transaction.createdAt)
        }
    }

    func loadData() async {
        isLoading = true
        defer { isLoading = false }

        // Mock data
        recentRecipients = [
            RecentRecipient(id: "1", name: "John D", identifier: "john@example.com"),
            RecentRecipient(id: "2", name: "Sarah M", identifier: "+1234567890"),
            RecentRecipient(id: "3", name: "Mike R", identifier: "mike@company.com"),
            RecentRecipient(id: "4", name: "Lisa K", identifier: "lisa@business.com"),
        ]

        transactions = [
            Transaction(type: .sent, amount: 250, recipientName: "John D", note: "Lunch", status: .completed, createdAt: Date().addingTimeInterval(-3600)),
            Transaction(type: .received, amount: 1000, senderName: "Sarah M", note: "Project payment", status: .completed, createdAt: Date().addingTimeInterval(-7200)),
            Transaction(type: .sent, amount: 75, recipientName: "Mike R", status: .completed, createdAt: Date().addingTimeInterval(-86400)),
            Transaction(type: .received, amount: 500, senderName: "Lisa K", note: "Invoice #123", status: .completed, createdAt: Date().addingTimeInterval(-172800)),
        ]
    }

    func refresh() async {
        await loadData()
    }
}

struct RecentRecipient: Identifiable {
    let id: String
    let name: String
    let identifier: String

    var initials: String {
        let components = name.components(separatedBy: " ")
        if components.count >= 2 {
            return String(components[0].prefix(1) + components[1].prefix(1))
        }
        return String(name.prefix(2)).uppercased()
    }
}

#Preview {
    PaymentsView()
}
