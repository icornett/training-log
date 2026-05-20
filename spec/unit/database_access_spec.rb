# frozen_string_literal: true

require 'spec_helper'

# Unit tests for DatabaseAccess validation logic.
# PG::Connection is stubbed so no real database is needed.
RSpec.describe DatabaseAccess do
  subject(:storage) { described_class.new }

  let(:mock_db) { instance_double(PG::Connection) }

  before do
    allow(PG).to receive(:connect).and_return(mock_db)
  end

  # ---------------------------------------------------------------------------
  # #valid_new_user?
  # ---------------------------------------------------------------------------
  describe '#valid_new_user?' do
    let(:existing_users_result) do
      [{ 'username' => 'existing_user' }]
    end

    before do
      allow(mock_db).to receive(:exec_params).and_return(existing_users_result)
    end

    it 'returns false when the username is already taken' do
      expect(storage.valid_new_user?('existing_user', 'validpassword123')).to be false
    end

    it 'returns false when the username exceeds 25 characters' do
      expect(storage.valid_new_user?('a' * 26, 'validpassword123')).to be false
    end

    it 'returns false when the password exceeds 25 characters' do
      expect(storage.valid_new_user?('newuser', 'p' * 26)).to be false
    end

    it 'returns false when the password is shorter than 10 characters' do
      expect(storage.valid_new_user?('newuser', 'short')).to be false
    end

    it 'returns false when the password is exactly 10 characters' do
      # boundary: size > 10 required
      expect(storage.valid_new_user?('newuser', '1234567890')).to be false
    end

    it 'returns true for a unique username with a password of exactly 11 characters' do
      allow(mock_db).to receive(:exec_params).and_return([])
      expect(storage.valid_new_user?('newuser', '12345678901')).to be true
    end

    it 'returns true for a valid new user with a unique username' do
      allow(mock_db).to receive(:exec_params).and_return([])
      expect(storage.valid_new_user?('newuser', 'validpassword')).to be true
    end
  end

  # ---------------------------------------------------------------------------
  # #invalid_workout_msg
  # ---------------------------------------------------------------------------
  describe '#invalid_workout_msg' do
    # Stub the internal DB calls used by valid_workout_details?
    let(:empty_workouts_result) { [] }

    before do
      allow(mock_db).to receive(:exec_params).and_return(empty_workouts_result)
    end

    it 'returns nil when the workout details are valid' do
      result = storage.invalid_workout_msg('Running', '2024-01-01', 'testuser', false)
      expect(result).to be_nil
    end

    it 'returns an error message when the workout name is too short (< 4 chars)' do
      result = storage.invalid_workout_msg('Leg', '2024-01-01', 'testuser', false)
      expect(result).to include('Invalid workout entry')
    end

    it 'returns an error message when the workout name is too long (> 15 chars)' do
      result = storage.invalid_workout_msg('A' * 16, '2024-01-01', 'testuser', false)
      expect(result).to include('Invalid workout entry')
    end

    it 'returns an error message when the user already has a workout on that date' do
      existing_workout = [{ 'name' => 'Legs', 'date' => '2024-01-01',
                            'id' => '1', 'username' => 'testuser' }]
      allow(mock_db).to receive(:exec_params).and_return(existing_workout)

      result = storage.invalid_workout_msg('Arms', '2024-01-01', 'testuser', false)
      expect(result).to include('Invalid workout entry')
    end

    it 'allows a workout name of exactly 4 characters (boundary check)' do
      result = storage.invalid_workout_msg('Legs', '2024-01-01', 'testuser', false)
      expect(result).to be_nil
    end

    it 'allows a workout name of exactly 15 characters' do
      result = storage.invalid_workout_msg('A' * 15, '2024-01-01', 'testuser', false)
      expect(result).to be_nil
    end
  end

  # ---------------------------------------------------------------------------
  # #invalid_exercise_edit_msg
  # ---------------------------------------------------------------------------
  describe '#invalid_exercise_edit_msg' do
    before do
      allow(mock_db).to receive(:exec_params).and_return([])
    end

    it 'returns nil for a valid description and weight' do
      result = storage.invalid_exercise_edit_msg('Bench press', '60 kgs', 1)
      expect(result).to be_nil
    end

    it 'returns an error when the description is fewer than 5 characters' do
      result = storage.invalid_exercise_edit_msg('Run', '60 kgs', 1)
      expect(result).to include('Invalid exercise entry')
    end

    it 'returns an error when the description exceeds 40 characters' do
      result = storage.invalid_exercise_edit_msg('A' * 41, '60 kgs', 1)
      expect(result).to include('Invalid exercise entry')
    end

    it 'returns an error when the weight unit is invalid' do
      result = storage.invalid_exercise_edit_msg('Bench press', '60 stones', 1)
      expect(result).to include('Invalid exercise entry')
    end

    it 'returns an error when the weight description exceeds 10 characters' do
      result = storage.invalid_exercise_edit_msg('Bench press', '1000000 kgs', 1)
      expect(result).to include('Invalid exercise entry')
    end

    it 'accepts "bodyweight" as a valid weight description' do
      result = storage.invalid_exercise_edit_msg('Push ups', 'bodyweight', 1)
      expect(result).to be_nil
    end

    it 'accepts "lbs" as a valid weight unit' do
      result = storage.invalid_exercise_edit_msg('Bench press', '135 lbs', 1)
      expect(result).to be_nil
    end

    it 'accepts a description of exactly 5 characters' do
      result = storage.invalid_exercise_edit_msg('Squat', '60 kgs', 1)
      expect(result).to be_nil
    end

    it 'accepts a description of exactly 40 characters' do
      result = storage.invalid_exercise_edit_msg('A' * 40, '60 kgs', 1)
      expect(result).to be_nil
    end
  end

  # ---------------------------------------------------------------------------
  # #invalid_new_exercise_msg
  # ---------------------------------------------------------------------------
  describe '#invalid_new_exercise_msg' do
    let(:existing_exercise) do
      [{ 'id' => '1', 'description' => 'bench press',
         'num_sets' => '3', 'num_reps' => '10', 'weight_description' => '60 kgs' }]
    end

    before do
      allow(mock_db).to receive(:exec_params).and_return(existing_exercise)
    end

    it 'returns an error when the description already exists in the workout' do
      result = storage.invalid_new_exercise_msg('bench press', '60 kgs', 1)
      expect(result).to include('Invalid exercise entry')
    end

    it 'is case-insensitive for duplicate detection' do
      result = storage.invalid_new_exercise_msg('BENCH PRESS', '60 kgs', 1)
      expect(result).to include('Invalid exercise entry')
    end

    it 'ignores whitespace differences when checking for duplicates' do
      result = storage.invalid_new_exercise_msg('bench  press', '60 kgs', 1)
      expect(result).to include('Invalid exercise entry')
    end

    it 'returns nil when the exercise is new and valid' do
      allow(mock_db).to receive(:exec_params).and_return([])
      result = storage.invalid_new_exercise_msg('Deadlift', '100 kgs', 1)
      expect(result).to be_nil
    end
  end

  # ---------------------------------------------------------------------------
  # #at_exercise_limit?
  # ---------------------------------------------------------------------------
  describe '#at_exercise_limit?' do
    it 'returns true when a workout already has 10 exercises' do
      allow(mock_db).to receive(:exec_params).and_return([{ 'count' => '10' }])
      expect(storage.at_exercise_limit?(1)).to be true
    end

    it 'returns false when a workout has fewer than 10 exercises' do
      allow(mock_db).to receive(:exec_params).and_return([{ 'count' => '9' }])
      expect(storage.at_exercise_limit?(1)).to be false
    end
  end

  # ---------------------------------------------------------------------------
  # #object_nonexistent?
  # ---------------------------------------------------------------------------
  describe '#object_nonexistent?' do
    it 'returns true when the id is not in the table' do
      allow(mock_db).to receive(:exec_params).and_return([{ 'id' => '1' }, { 'id' => '2' }])
      expect(storage.object_nonexistent?('workouts', 99)).to be true
    end

    it 'returns false when the id exists in the table' do
      allow(mock_db).to receive(:exec_params).and_return([{ 'id' => '1' }, { 'id' => '2' }])
      expect(storage.object_nonexistent?('workouts', 1)).to be false
    end
  end
end
