# frozen_string_literal: true

require 'spec_helper'

# E2E tests drive the application through the browser layer (Capybara).
# These use the rack_test driver by default and a mocked DatabaseAccess so they
# can run without a live PostgreSQL instance. Tests that need a real database
# (e.g. verifying persisted data across sessions) should be tagged :db and run
# against a dedicated test database in CI.
RSpec.describe 'Training Log E2E', type: :e2e do # rubocop:disable RSpec/DescribeClass
  include_context 'with mocked storage'

  # ---------------------------------------------------------------------------
  # Login journey
  # ---------------------------------------------------------------------------
  describe 'Login page' do
    it 'shows the login form' do
      visit '/login'
      expect(page).to have_button('Login')
    end

    it 'shows a Signup button' do
      visit '/login'
      expect(page).to have_button('Signup')
    end

    context 'with invalid credentials' do
      before do
        allow(mock_storage).to receive(:valid_login_credentials?).and_return(false)
      end

      it 'displays an error message and stays on the login page' do
        visit '/login'
        fill_in 'username', with: 'baduser'
        fill_in 'password', with: 'wrongpassword'
        click_button 'Login'
        expect(page).to have_content('Incorrect login credentials')
      end
    end

    context 'with valid credentials' do
      before do
        allow(mock_storage).to receive_messages(
          valid_login_credentials?: true,
          count: 1.0,
          load_workouts_subset: [{ id: 1, name: 'Upper Body', date: '2024-01-01', username: 'testuser' }]
        )
      end

      it 'redirects to the training log after login' do
        visit '/login'
        fill_in 'username', with: 'testuser'
        fill_in 'password', with: 'validpassword'
        click_button 'Login'
        expect(page).to have_current_path('/training_log/1/workouts')
      end
    end
  end

  # ---------------------------------------------------------------------------
  # Signup journey
  # ---------------------------------------------------------------------------
  describe 'Signup page' do
    it 'shows the signup form' do
      visit '/signup'
      expect(page).to have_field('username')
      expect(page).to have_field('password')
    end

    context 'with invalid details' do
      before do
        allow(mock_storage).to receive(:valid_new_user?).and_return(false)
      end

      it 'shows an error and stays on the signup page' do
        visit '/signup'
        fill_in 'username', with: 'x'
        fill_in 'password', with: 'short'
        click_button 'Signup'
        expect(page).to have_content('Usernames & passwords cannot exceed')
      end
    end

    context 'with valid details' do
      before do
        allow(mock_storage).to receive(:add_user!)
        allow(mock_storage).to receive_messages(valid_new_user?: true, unique_usernames: %w[testuser newuser],
                                                count: 0.0, load_workouts_subset: [])
      end

      it 'redirects to the training log after signup' do
        visit '/signup'
        fill_in 'username', with: 'newuser'
        fill_in 'password', with: 'validpassword123'
        click_button 'Signup'
        expect(page.current_path).to eq('/training_log/1/workouts')
      end
    end
  end

  # ---------------------------------------------------------------------------
  # Workouts list journey
  # ---------------------------------------------------------------------------
  describe 'Workouts list' do
    before do
      allow(mock_storage).to receive_messages(valid_login_credentials?: true, count: 2.0, load_workouts_subset: [
                                                { id: 1, name: 'Upper Body', date: '2024-01-01', username: 'testuser' },
                                                { id: 2, name: 'Lower Body', date: '2024-01-02', username: 'testuser' }
                                              ])
    end

    it 'displays all workouts after login' do
      visit '/login'
      fill_in 'username', with: 'testuser'
      fill_in 'password', with: 'validpassword'
      click_button 'Login'

      expect(page).to have_content('Upper Body')
      expect(page).to have_content('Lower Body')
    end

    it 'shows an Add Workout button' do
      visit '/login'
      fill_in 'username', with: 'testuser'
      fill_in 'password', with: 'validpassword'
      click_button 'Login'
      expect(page).to have_button('Add Workout')
    end
  end

  # ---------------------------------------------------------------------------
  # Individual workout journey
  # ---------------------------------------------------------------------------
  describe 'Individual workout page' do
    let(:workout) { { id: 1, name: 'Upper Body', date: '2024-01-01', username: 'testuser' } }

    before do
      allow(mock_storage).to receive_messages(
        valid_login_credentials?: true,
        count: 1.0,
        load_workouts_subset: [workout],
        object_nonexistent?: false,
        workout_details: workout,
        load_exercises: [{ id: 1, desc: 'Bench press', num_sets: '3', num_reps: '10', weight_desc: '60 kgs' }],
        at_exercise_limit?: false
      )
    end

    it 'displays the workout details' do
      visit '/login'
      fill_in 'username', with: 'testuser'
      fill_in 'password', with: 'validpassword'
      click_button 'Login'

      visit '/training_log/1/workouts/1'
      expect(page).to have_content('Upper Body')
      expect(page).to have_content('Bench press')
    end

    it 'shows edit controls to the workout owner' do
      visit '/login'
      fill_in 'username', with: 'testuser'
      fill_in 'password', with: 'validpassword'
      click_button 'Login'

      visit '/training_log/1/workouts/1'
      expect(page).to have_button('Edit Workout Details')
      expect(page).to have_button('Delete Workout')
    end
  end
end
