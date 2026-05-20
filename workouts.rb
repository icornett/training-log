# frozen_string_literal: true

require 'sinatra'
require 'sinatra/content_for'
require 'tilt/erubi'
require 'bcrypt'

require_relative 'database_access'

configure do
  enable :sessions
  set :erb, escape_html: true
end

configure(:development) do
  require 'sinatra/reloader'
  also_reload 'database_access.rb'
end

before do
  @storage = DatabaseAccess.new
end

helpers do
  def next_page_num(current_page)
    proposed = current_page + 1
    proposed > max_number_pages ? 1 : proposed
  end

  def prior_page_num(current_page)
    proposed = current_page - 1
    current_page == 1 ? max_number_pages : proposed
  end

  def max_number_pages
    calculated_num = (@storage.count('id', 'workouts', ';') / 10).ceil
    min_allowed = 1
    [calculated_num, min_allowed].max
  end

  def allow_editing?(username)
    session[:username] == username
  end

  def new_workouts_page_num
    ((@storage.count('id', 'workouts', ';') + 1) / 10).ceil
  end

  def can_add_more_exercises?
    !@storage.at_exercise_limit?(@workout[:id])
  end
end

def calc_offset(page_number)
  (page_number - 1) * 10
end

def logged_out?
  !@storage.unique_usernames.include?(session[:username])
end

def logged_out_redirect_msg
  return unless logged_out?

  session[:message] = 'Please login to access the Training Log App.'
  session[:route_once_logged_in] = request.fullpath
  redirect '/login'
end

def nonexistent_object_redirect(table, id, page_num)
  return unless @storage.object_nonexistent?(table, id)

  object_type = table.chop.capitalize
  session[:message] = "#{object_type} ##{id} doesn't exist."
  redirect "/training_log/#{page_num}/workouts"
end

def add_exercise_access_error(correct_user_indicator)
  if correct_user_indicator
    "You've already logged 10 exercises for this workout."
  else
    "You may not add exercises to someone else's workout."
  end
end

def invalid_parameter_msg(url_params)
  valid_flag = valid_parameter?(url_params)
  return if valid_flag

  <<~MSG
    At least one of your url parameters: #{url_params} is incorrect.
    Please ensure that you only enter numbers when trying to access
    a specific page number, workout, or exercise.
  MSG
end

def valid_parameter?(url_parameters)
  url_parameters.all? do |string_param|
    string_param.count('0-9') == string_param.size
  end
end

def invalid_param_redirect(*url_parameters)
  invalid_msg = invalid_parameter_msg(url_parameters)
  return unless invalid_msg

  session[:message] = invalid_msg
  redirect '/training_log/1/workouts'
end

get '/login' do
  erb :login
end

get '/signup' do
  erb :signup
end

post '/login' do
  username = params[:username].strip
  pw = params[:password]

  if @storage.valid_login_credentials?(username, pw)
    session[:username] = username

    route = session.delete(:route_once_logged_in)
    url = route || '/training_log/1/workouts'
    redirect url
  else
    session[:message] = 'Incorrect login credentials. Please try again.'
    status 422
    erb :login
  end
end

post '/signup' do
  username = params[:username].strip
  pw = params[:password]

  if @storage.valid_new_user?(username, pw)
    @storage.add_user!(username, pw)
    session[:username] = username
    redirect '/'
  else
    session[:message] = <<~MSG
      Usernames & passwords cannot exceed 25 characters,
      all usernames must be unique, and passwords must
      be at least 10 characters. Please try again.
    MSG
    erb :signup
  end
end

get '/training_log' do
  logged_out_redirect_msg

  redirect '/training_log/1/workouts'
end

get '/training_log/:page_number/workouts' do
  logged_out_redirect_msg

  invalid_param_redirect(params[:page_number])
  @page_number = params[:page_number].to_i

  if @page_number > max_number_pages
    session[:message] = "Page #{@page_number} doesn't exist."
    @page_number = max_number_pages
  end

  offset = calc_offset(@page_number)
  @workouts = @storage.load_workouts_subset(offset)
  erb :workouts
end

get '/' do
  logged_out_redirect_msg

  redirect '/training_log/1/workouts'
end

get '/training_log/:page_number/workouts/new' do
  logged_out_redirect_msg

  @page_number = params[:page_number]
  invalid_param_redirect(@page_number)

  erb :new_workout
end

post '/training_log/:page_number/workouts/new_workout_id' do
  @page_number = params[:page_number]
  name = params[:workout_name]
  date = params[:workout_date]
  username = session[:username]
  user_id = @storage.find_user_id(username)

  error = @storage.invalid_workout_msg(name, date, username, false)

  if error
    session[:message] = error
    redirect "/training_log/#{@page_number}/workouts/new"
  else
    @storage.add_workout!(name, date, user_id)
    @new_workout_id = @storage.max_workout_id

    session[:message] = "You've successfully created a new workout."
    redirect "/training_log/#{@page_number}/workouts/#{@new_workout_id}"
  end
end

get '/training_log/:page_number/workouts/:workout_id/exercises/new' do
  logged_out_redirect_msg

  @page_number = params[:page_number]
  invalid_param_redirect(@page_number, params[:workout_id])

  @workout_id = params[:workout_id].to_i
  @workout = @storage.workout_details(@workout_id)

  add_more_flag = !@storage.at_exercise_limit?(@workout_id)
  correct_user_flag = allow_editing?(@workout[:username])

  error = add_exercise_access_error(correct_user_flag)

  if correct_user_flag && add_more_flag
    erb :new_exercise
  else
    session[:message] = error
    redirect "/training_log/#{@page_number}/workouts/#{@workout_id}"
  end
end

post '/training_log/:page_number/workouts/:workout_id/exercises/new' do
  @page_number = params[:page_number]
  @workout_id = params[:workout_id].to_i

  desc_prepped = params[:exercise_desc].gsub(/[[:punct:]]/, '')
  weights_prepped = params[:weights_used].downcase

  desc = desc_prepped
  sets = params[:number_sets]
  reps = params[:number_reps]
  weights = weights_prepped

  error = @storage.invalid_new_exercise_msg(desc, weights, @workout_id)

  if error
    session[:message] = error
    redirect "/training_log/#{@page_number}/workouts/#{@workout_id}/exercises/new"
  else
    @storage.add_exercise!(desc, sets, reps, weights, @workout_id)
    session[:message] = "You've successfully added #{desc} to your workout."
    redirect "/training_log/#{@page_number}/workouts/#{@workout_id}"
  end
end

get '/training_log/:page_number/workouts/:workout_id' do
  logged_out_redirect_msg

  @page_number = params[:page_number]
  invalid_param_redirect(@page_number, params[:workout_id])

  @workout_id = params[:workout_id].to_i
  nonexistent_object_redirect('workouts', @workout_id, @page_number)

  @workout = @storage.workout_details(@workout_id)
  @exercises = @storage.load_exercises(@workout_id)

  erb :individual_workout
end

get '/training_log/:page_number/workouts/:workout_id/edit' do
  logged_out_redirect_msg

  @page_number = params[:page_number]
  invalid_param_redirect(@page_number, params[:workout_id])

  @workout_id = params[:workout_id].to_i
  @workout = @storage.workout_details(@workout_id)

  nonexistent_object_redirect('workouts', @workout_id, @page_number)

  if allow_editing?(@workout[:username])
    erb :edit_workout
  else
    msg = <<~MSG
      Workout ##{@workout_id} isn't your workout to edit.
      You may only view its details.
    MSG
    session[:message] = msg
    redirect "/training_log/#{@page_number}/workouts/#{@workout_id}"
  end
end

get '/training_log/:page_number/workouts/:workout_id/exercises/:exercise_id/edit' do
  logged_out_redirect_msg

  @page_number = params[:page_number]
  invalid_param_redirect(@page_number, params[:workout_id], params[:exercise_id])

  @workout_id = params[:workout_id].to_i
  @exercise_id = params[:exercise_id].to_i
  @workout = @storage.workout_details(@workout_id)

  nonexistent_object_redirect('exercises', @exercise_id, @page_number)

  if allow_editing?(@workout[:username])
    @exercise = @storage.exercise_details(@exercise_id)
    erb :edit_exercise
  else
    msg = <<~MSG
      You are not allowed to edit another user's workout.
      You may only view this workout & its exercises.
    MSG
    session[:message] = msg
    redirect "/training_log/#{@page_number}/workouts/#{@workout_id}"
  end
end

post '/training_log/:page_number/workouts/new/' do
  @workout_name = params[:workout_name].strip
  redirect '/'
end

post '/training_log/:page_number/workouts/:workout_id/edit' do
  @workout_id = params[:workout_id].to_i
  @page_number = params[:page_number]

  name = params[:workout_name]
  date = params[:workout_date]
  username = session[:username]

  error = @storage.invalid_workout_msg(name, date, username, @workout_id)

  if error
    session[:message] = error
    redirect "training_log/#{@page_number}/workouts/#{@workout_id}/edit"
  else
    @storage.update_workout!(name, date, @workout_id)
    session[:message] = "You've successfully updated workout #{@workout_id}"
    redirect "/training_log/#{@page_number}/workouts/#{@workout_id}"
  end
end

post '/training_log/:page_number/workouts/:workout_id/delete' do
  @page_number = params[:page_number]
  @workout_id = params[:workout_id]

  @storage.delete_record!(@workout_id, 'workouts')
  session[:message] = "You successfully deleted workout ##{@workout_id}."

  redirect "/training_log/#{max_number_pages}/workouts"
end

post '/training_log/:page_number/workouts/:workout_id/exercises/:exercise_id/edit' do
  @page_number = params[:page_number]
  @workout_id = params[:workout_id]

  exercise_id = params[:exercise_id].to_i
  desc = params[:exercise_desription]
  sets = params[:number_sets].to_i
  reps = params[:number_reps].to_i
  weight = params[:weights_used]

  error = @storage.invalid_exercise_edit_msg(desc, weight, @workout_id)
  if error
    session[:message] = error
    redirect "/training_log/#{@page_number}/workouts/#{@workout_id}/exercises/#{exercise_id}/edit"
  else
    session[:message] = "You've successfully updated exercise ##{exercise_id}"
    @storage.update_exercise!(desc, sets, reps, weight, exercise_id)
    redirect "/training_log/#{@page_number}/workouts/#{@workout_id}"
  end
end

post '/training_log/:page_number/workouts/:workout_id/exercises/:exercise_id/delete' do
  @page_number = params[:page_number]
  @workout_id = params[:workout_id]
  @exercise_id = params[:exercise_id]
  @exercise = @storage.exercise_details(@exercise_id)

  @storage.delete_record!(@exercise_id, 'exercises')
  session[:message] = "You removed #{@exercise[:desc]} from this workout."
  redirect "/training_log/#{@page_number}/workouts/#{@workout_id}"
end

post '/logout' do
  session.delete(:username)
  session[:message] = 'You have successfully logged out.'
  redirect '/login'
end

post '/delete_account' do
  username = session.delete(:username)
  user_id = @storage.find_user_id(username)
  @storage.delete_record!(user_id, 'users')

  session[:message] = "All account data for '#{username}' has been deleted."
  redirect '/signup'
end
