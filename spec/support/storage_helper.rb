# frozen_string_literal: true

# Shared helpers for tests that use a mocked DatabaseAccess.
# Include with: include_context 'with mocked storage'
RSpec.shared_context 'with mocked storage' do
  let(:mock_storage) { instance_double(DatabaseAccess) }

  before do
    allow(DatabaseAccess).to receive(:new).and_return(mock_storage)
    # Provide sane defaults; override per-example as needed
    allow(mock_storage).to receive(:unique_usernames).and_return(['testuser'])
  end
end
