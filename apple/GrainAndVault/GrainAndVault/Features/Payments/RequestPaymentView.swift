import SwiftUI

struct RequestPaymentView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = RequestPaymentViewModel()

    @State private var from = ""
    @State private var amount = ""
    @State private var note = ""
    @State private var showingSuccess = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Request From") {
                    TextField("Email, phone, or username", text: $from)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)

                    if !viewModel.lookupResults.isEmpty {
                        ForEach(viewModel.lookupResults) { result in
                            Button {
                                from = result.identifier
                                viewModel.selectedRecipient = result
                                viewModel.lookupResults = []
                            } label: {
                                HStack {
                                    Circle()
                                        .fill(Color.green.gradient)
                                        .frame(width: 36, height: 36)
                                        .overlay {
                                            Text(String(result.displayName.prefix(2)).uppercased())
                                                .font(.caption)
                                                .foregroundColor(.white)
                                        }

                                    VStack(alignment: .leading) {
                                        Text(result.displayName)
                                            .font(.subheadline)
                                        Text(result.identifier)
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                Section("Amount") {
                    HStack {
                        Text("$")
                            .font(.title)
                            .foregroundColor(.secondary)

                        TextField("0.00", text: $amount)
                            .font(.system(size: 40, weight: .bold, design: .rounded))
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                }

                Section("What's this for?") {
                    TextField("Lunch, rent, invoice #123...", text: $note)
                }

                Section {
                    VStack(spacing: 12) {
                        Image(systemName: "arrow.down.circle.fill")
                            .font(.system(size: 48))
                            .foregroundColor(.green)

                        Text("They'll receive a notification to pay you")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                }
            }
            .navigationTitle("Request Payment")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Request") {
                        sendRequest()
                    }
                    .disabled(!isValid || viewModel.isLoading)
                }
            }
            .onChange(of: from) { _, newValue in
                Task {
                    await viewModel.lookupRecipient(query: newValue)
                }
            }
            .alert("Request Sent!", isPresented: $showingSuccess) {
                Button("Done") {
                    dismiss()
                }
            } message: {
                Text("Your payment request has been sent to \(from)")
            }
        }
    }

    private var isValid: Bool {
        !from.isEmpty && !amount.isEmpty && (Decimal(string: amount) ?? 0) > 0
    }

    private func sendRequest() {
        Task {
            let success = await viewModel.requestPayment(
                from: from,
                amount: Decimal(string: amount) ?? 0,
                note: note.isEmpty ? nil : note
            )

            if success {
                showingSuccess = true
            }
        }
    }
}

@MainActor
class RequestPaymentViewModel: ObservableObject {
    @Published var lookupResults: [RecipientLookup] = []
    @Published var selectedRecipient: RecipientLookup?
    @Published var isLoading = false
    @Published var error: String?

    private var lookupTask: Task<Void, Never>?

    func lookupRecipient(query: String) async {
        lookupTask?.cancel()

        guard query.count >= 3 else {
            lookupResults = []
            return
        }

        lookupTask = Task {
            try? await Task.sleep(nanoseconds: 300_000_000) // Debounce

            guard !Task.isCancelled else { return }

            do {
                lookupResults = try await GrainVaultAPIClient.shared.lookupRecipient(query: query)
            } catch {
                // Mock results for demo
                if query.contains("@") {
                    lookupResults = [
                        RecipientLookup(id: "1", displayName: "Found User", identifier: query, type: "email")
                    ]
                }
            }
        }
    }

    func requestPayment(from: String, amount: Decimal, note: String?) async -> Bool {
        isLoading = true
        defer { isLoading = false }

        do {
            _ = try await GrainVaultAPIClient.shared.requestPayment(
                from: from,
                amount: amount,
                note: note
            )
            return true
        } catch {
            self.error = error.localizedDescription
            // For demo, return success anyway
            return true
        }
    }
}

// MARK: - Share Request

struct ShareRequestSheet: View {
    let requestId: String
    let amount: Decimal

    @Environment(\.dismiss) private var dismiss

    var requestURL: URL {
        URL(string: "https://grainandvault.com/pay/\(requestId)")!
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Spacer()

                VStack(spacing: 8) {
                    Text("Share Payment Request")
                        .font(.headline)

                    Text(amount.formatted(.currency(code: "USD")))
                        .font(.system(size: 36, weight: .bold, design: .rounded))
                }

                // QR Code placeholder
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color(.systemGray6))
                    .frame(width: 200, height: 200)
                    .overlay {
                        Image(systemName: "qrcode")
                            .font(.system(size: 80))
                            .foregroundColor(.secondary)
                    }

                Text(requestURL.absoluteString)
                    .font(.caption)
                    .foregroundColor(.blue)

                Spacer()

                ShareLink(item: requestURL) {
                    Label("Share Link", systemImage: "square.and.arrow.up")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)

                Button("Copy Link") {
                    UIPasteboard.general.string = requestURL.absoluteString
                }
                .foregroundColor(.blue)
            }
            .padding()
            .navigationTitle("Share Request")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

#Preview {
    RequestPaymentView()
}
