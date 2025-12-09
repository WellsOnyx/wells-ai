import SwiftUI
import Charts

struct TreasuryDashboard: View {
    @StateObject private var viewModel = TreasuryViewModel()
    @Environment(\.modelContext) private var modelContext

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Balance Card
                    BalanceCard(viewModel: viewModel)

                    // Quick Actions
                    QuickActionsRow()

                    // Credit Line Card (if approved)
                    if viewModel.creditAvailable > 0 {
                        CreditCard(viewModel: viewModel)
                    }

                    // Recent Transactions
                    RecentTransactionsSection(transactions: viewModel.recentTransactions)
                }
                .padding()
            }
            .navigationTitle("Treasury")
            .refreshable {
                await viewModel.refresh()
            }
            .task {
                await viewModel.loadData()
            }
        }
    }
}

struct BalanceCard: View {
    @ObservedObject var viewModel: TreasuryViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("GRAIN Balance")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Spacer()

                if viewModel.isLoading {
                    ProgressView()
                        .scaleEffect(0.7)
                } else {
                    Text(viewModel.lastUpdated.formatted(.relative(presentation: .named)))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }

            Text(viewModel.grainBalance.formatted(.currency(code: "USD")))
                .font(.system(size: 44, weight: .bold, design: .rounded))

            HStack {
                Image(systemName: "arrow.up.right")
                    .foregroundColor(.green)
                    .font(.caption)

                Text("\(viewModel.appreciationRate, specifier: "%.2f")% APY")
                    .font(.subheadline)
                    .foregroundColor(.green)

                Spacer()

                Text("= \(viewModel.usdEquivalent.formatted(.currency(code: "USD"))) USD")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            // Mini chart placeholder
            if !viewModel.chartData.isEmpty {
                Chart(viewModel.chartData) { point in
                    LineMark(
                        x: .value("Date", point.date),
                        y: .value("Value", point.value)
                    )
                    .foregroundStyle(.green.gradient)
                }
                .frame(height: 80)
                .chartXAxis(.hidden)
                .chartYAxis(.hidden)
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(16)
    }
}

struct QuickActionsRow: View {
    var body: some View {
        HStack(spacing: 16) {
            QuickActionButton(
                title: "Send",
                icon: "arrow.up.circle.fill",
                color: .blue,
                destination: AnyView(SendPaymentView())
            )

            QuickActionButton(
                title: "Request",
                icon: "arrow.down.circle.fill",
                color: .green,
                destination: AnyView(RequestPaymentView())
            )

            QuickActionButton(
                title: "Draw",
                icon: "creditcard.fill",
                color: .purple,
                destination: AnyView(DrawFundsView())
            )

            QuickActionButton(
                title: "Deposit",
                icon: "plus.circle.fill",
                color: .orange,
                destination: AnyView(DepositView())
            )
        }
    }
}

struct QuickActionButton<Destination: View>: View {
    let title: String
    let icon: String
    let color: Color
    let destination: Destination

    var body: some View {
        NavigationLink(destination: destination) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(color)

                Text(title)
                    .font(.caption)
                    .foregroundColor(.primary)
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color(.systemGray6))
            .cornerRadius(12)
        }
        .buttonStyle(.plain)
    }
}

struct CreditCard: View {
    @ObservedObject var viewModel: TreasuryViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "creditcard.fill")
                    .foregroundColor(.purple)
                Text("Credit Line")
                    .font(.headline)
                Spacer()
                Text("\(viewModel.creditAPR, specifier: "%.1f")% APR")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            // Credit utilization bar
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Rectangle()
                        .fill(Color.gray.opacity(0.2))
                        .frame(height: 8)
                        .cornerRadius(4)

                    Rectangle()
                        .fill(Color.purple.gradient)
                        .frame(width: geometry.size.width * viewModel.creditUtilization, height: 8)
                        .cornerRadius(4)
                }
            }
            .frame(height: 8)

            HStack {
                VStack(alignment: .leading) {
                    Text("Available")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(viewModel.creditAvailable.formatted(.currency(code: "USD")))
                        .font(.headline)
                }

                Spacer()

                VStack(alignment: .trailing) {
                    Text("Used")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(viewModel.creditUsed.formatted(.currency(code: "USD")))
                        .font(.headline)
                }
            }

            NavigationLink(destination: CreditLineView()) {
                Text("Manage Credit Line")
                    .font(.subheadline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(Color.purple.opacity(0.1))
                    .foregroundColor(.purple)
                    .cornerRadius(8)
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(16)
    }
}

struct RecentTransactionsSection: View {
    let transactions: [Transaction]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Recent Activity")
                    .font(.headline)
                Spacer()
                NavigationLink(destination: TransactionHistoryView()) {
                    Text("See All")
                        .font(.subheadline)
                        .foregroundColor(.blue)
                }
            }

            if transactions.isEmpty {
                Text("No recent transactions")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
            } else {
                ForEach(transactions.prefix(5)) { transaction in
                    TransactionRow(transaction: transaction)
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(16)
    }
}

struct TransactionRow: View {
    let transaction: Transaction

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: transaction.type.icon)
                .font(.title3)
                .foregroundColor(transaction.isIncoming ? .green : .red)
                .frame(width: 40, height: 40)
                .background(Color(.systemGray5))
                .cornerRadius(10)

            VStack(alignment: .leading, spacing: 2) {
                Text(transaction.recipientName ?? transaction.type.displayName)
                    .font(.subheadline)
                    .fontWeight(.medium)

                Text(transaction.createdAt.formatted(.relative(presentation: .named)))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Text(transaction.isIncoming ? "+\(transaction.displayAmount)" : "-\(transaction.displayAmount)")
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundColor(transaction.isIncoming ? .green : .primary)
        }
        .padding(.vertical, 4)
    }
}

// Placeholder views
struct RequestPaymentView: View {
    var body: some View {
        Text("Request Payment")
            .navigationTitle("Request")
    }
}

struct DepositView: View {
    var body: some View {
        Text("Deposit Funds")
            .navigationTitle("Deposit")
    }
}

struct TransactionHistoryView: View {
    var body: some View {
        Text("Transaction History")
            .navigationTitle("History")
    }
}

#Preview {
    TreasuryDashboard()
        .environmentObject(GVAuthManager.shared)
}
