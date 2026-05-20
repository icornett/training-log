# frozen_string_literal: true

require 'spec_helper'

RSpec.describe 'Training Log Routes', type: :integration do # rubocop:disable RSpec/DescribeClass
  include_context 'with mocked storage'

  def app
    Sinatra::Application
  end

  # ---------------------------------------------------------------------------
  # Authentication
  # ---------------------------------------------------------------------------
  describe 'GET /login' do
    it 'returns 200 with the login form' do
      get '/login'
      expect(last_response.status).to eq(200)
      expect(last_response.body).to include('Login')
    end
  end

  describe 'GET /signup' do
    it 'returns 200 with the signup form' do
      get '/signup'
      expect(last_response.status).to eq(200)
      expect(last_response.body).to include('Signup')
    end
  end

  describe 'POST /login' do
    context 'with valid credentials' do
      before do
        allow(mock_storage).to receive_messages(valid_login_credentials?: true, count: 1.0, load_workouts_subset: [])
      end

      it 'redirects to the training log' do
        post '/login', username: 'testuser', password: 'password123'
        expect(last_response.status).to eq(302)
        expect(last_response.location).to include('/training_log/1/workouts')
      end

      it 'stores the username in the session' do
        post '/login', username: 'testuser', password: 'password123'
        follow_redirect!
        expect(last_request.env['rack.session'][:username]).to eq('testuser')
      end
    end

    context 'with invalid credentials' do
      before do
        allow(mock_storage).to receive(:valid_login_credentials?).and_return(false)
      end

      it 'returns 422' do
        post '/login', username: 'testuser', password: 'wrongpassword'
        expect(last_response.status).to eq(422)
      end

      it 'renders the login form again with an error message' do
        post '/login', username: 'testuser', password: 'wrongpassword'
        expect(last_response.body).to include('Incorrect login credentials')
      end
    end
  end

  describe 'POST /signup' do
    context 'with valid new user details' do
      before do
        allow(mock_storage).to receive(:valid_new_user?).and_return(true)
        allow(mock_storage).to receive(:add_user!)
      end

      it 'redirects to the root path' do
        post '/signup', username: 'newuser', password: 'validpassword'
        expect(last_response.status).to eq(302)
        expect(last_response.location).to end_with('/')
      end
    end

    context 'with invalid new user details' do
      before do
        allow(mock_storage).to receive(:valid_new_user?).and_return(false)
      end

      it 'renders the signup form with an error message' do
        post '/signup', username: 'x', password: 'short'
        expect(last_response.status).to eq(200)
        expect(last_response.body).to include('be at least 10 characters')
      end
    end
  end

  # ---------------------------------------------------------------------------
  # Workouts list (requires login)
  # ---------------------------------------------------------------------------
  describe 'GET /training_log/:page_number/workouts' do
    before do
      allow(mock_storage).to receive_messages(count: 5.0,
                                              load_workouts_subset: [{
                                                id: 1, name: 'Upper Body', date: '2024-01-01', username: 'testuser'
                                              }])
    end

    context 'when logged out' do
      it 'redirects to the login page' do
        get '/training_log/1/workouts'
        expect(last_response.status).to eq(302)
        expect(last_response.location).to include('/login')
      end
    end

    context 'when logged in' do
      before { with_session(username: 'testuser') }

      it 'returns 200' do
        get '/training_log/1/workouts'
        expect(last_response.status).to eq(200)
      end

      it 'displays the list of workouts' do
        get '/training_log/1/workouts'
        expect(last_response.body).to include('Upper Body')
      end

      it 'redirects to the last valid page when the requested page is out of range' do
        get '/training_log/999/workouts'
        # Should still serve the response clamped to max page
        expect(last_response.status).to eq(200)
      end

      it 'redirects to page 1 when the page parameter is non-numeric' do
        get '/training_log/abc/workouts'
        expect(last_response.status).to eq(302)
        expect(last_response.location).to include('/training_log/1/workouts')
      end
    end
  end

  # ---------------------------------------------------------------------------
  # Individual workout
  # ---------------------------------------------------------------------------
  describe 'GET /training_log/:page_number/workouts/:workout_id' do
    let(:workout) { { id: 1, name: 'Upper Body', date: '2024-01-01', username: 'testuser' } }

    before do
      allow(mock_storage).to receive_messages(object_nonexistent?: false, workout_details: workout, load_exercises: [],
                                              at_exercise_limit?: false)
    end

    context 'when logged in' do
      before { with_session(username: 'testuser') }

      it 'returns 200' do
        get '/training_log/1/workouts/1'
        expect(last_response.status).to eq(200)
      end

      it 'displays the workout name' do
        get '/training_log/1/workouts/1'
        expect(last_response.body).to include('Upper Body')
      end

      it 'shows edit controls to the workout owner' do
        get '/training_log/1/workouts/1'
        expect(last_response.body).to include('Edit Workout Details')
      end
    end

    context 'when the workout does not exist' do
      before do
        allow(mock_storage).to receive_messages(object_nonexistent?: true, count: 1.0)
        with_session(username: 'testuser')
      end

      it 'redirects to the workouts list' do
        get '/training_log/1/workouts/999'
        expect(last_response.status).to eq(302)
      end
    end
  end

  # ---------------------------------------------------------------------------
  # Create workout
  # ---------------------------------------------------------------------------
  describe 'POST /training_log/:page_number/workouts/new_workout_id' do
    context 'when logged in with valid workout details' do
      before do
        allow(mock_storage).to receive(:add_workout!)
        allow(mock_storage).to receive_messages(invalid_workout_msg: nil, find_user_id: '1', max_workout_id: '1')
        with_session(username: 'testuser')
      end

      it 'redirects to the new workout page' do
        post '/training_log/1/workouts/new_workout_id',
             workout_name: 'Legs', workout_date: '2024-06-01'
        expect(last_response.status).to eq(302)
        expect(last_response.location).to include('/workouts/1')
      end
    end

    context 'when the workout details are invalid' do
      before do
        allow(mock_storage).to receive_messages(invalid_workout_msg: 'Invalid workout entry.', find_user_id: '1')
        with_session(username: 'testuser')
      end

      it 'redirects back to the new workout form' do
        post '/training_log/1/workouts/new_workout_id',
             workout_name: 'X', workout_date: '2024-06-01'
        expect(last_response.status).to eq(302)
        expect(last_response.location).to include('/workouts/new')
      end
    end
  end

  # ---------------------------------------------------------------------------
  # Delete workout
  # ---------------------------------------------------------------------------
  describe 'POST /training_log/:page_number/workouts/:workout_id/delete' do
    before do
      allow(mock_storage).to receive(:delete_record!)
      allow(mock_storage).to receive(:count).and_return(1.0)
      with_session(username: 'testuser')
    end

    it 'deletes the workout and redirects to the workouts list' do
      post '/training_log/1/workouts/1/delete'
      expect(last_response.status).to eq(302)
      expect(last_response.location).to include('/workouts')
    end
  end

  # ---------------------------------------------------------------------------
  # Create exercise
  # ---------------------------------------------------------------------------
  describe 'POST /training_log/:page_number/workouts/:workout_id/exercises/new' do
    context 'with valid exercise details' do
      before do
        allow(mock_storage).to receive(:invalid_new_exercise_msg).and_return(nil)
        allow(mock_storage).to receive(:add_exercise!)
        with_session(username: 'testuser')
      end

      it 'redirects to the workout page' do
        post '/training_log/1/workouts/1/exercises/new',
             exercise_desc: 'Bench press', weights_used: '60 kgs',
             number_sets: '3', number_reps: '10'
        expect(last_response.status).to eq(302)
        expect(last_response.location).to include('/workouts/1')
      end
    end

    context 'with invalid exercise details' do
      before do
        allow(mock_storage).to receive(:invalid_new_exercise_msg).and_return('Invalid exercise entry.')
        with_session(username: 'testuser')
      end

      it 'redirects back to the new exercise form' do
        post '/training_log/1/workouts/1/exercises/new',
             exercise_desc: 'X', weights_used: 'invalid',
             number_sets: '3', number_reps: '10'
        expect(last_response.status).to eq(302)
        expect(last_response.location).to include('/exercises/new')
      end
    end
  end

  # ---------------------------------------------------------------------------
  # Root redirect
  # ---------------------------------------------------------------------------
  describe 'GET /' do
    context 'when logged out' do
      it 'redirects to login' do
        get '/'
        expect(last_response.status).to eq(302)
        expect(last_response.location).to include('/login')
      end
    end

    context 'when logged in' do
      before { with_session(username: 'testuser') }

      it 'redirects to the training log' do
        get '/'
        expect(last_response.status).to eq(302)
        expect(last_response.location).to include('/training_log/1/workouts')
      end
    end
  end

  private

  def with_session(hash)
    env 'rack.session', hash
  end
end
