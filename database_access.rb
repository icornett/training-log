# frozen_string_literal: true

require 'pg'

# Manages database interactions for the training log application
class DatabaseAccess
  def initialize
    @db = PG.connect(dbname: 'training_log')
  end

  def unique_usernames
    sql = <<~SQL
      SELECT username FROM users
        GROUP BY username;
    SQL
    usernames = query(sql)
    map_values_in_one_column(usernames, 'username')
  end

  def find_user_id(username)
    sql = <<~SQL
      SELECT id FROM users
        WHERE username = $1;
    SQL
    user_id = query(sql, username)
    map_values_in_one_column(user_id, 'id').first
  end

  def object_nonexistent?(table, id)
    ids = unique_ids(table).map(&:to_i)
    !ids.include?(id)
  end

  def count(column, tablename, end_clause)
    sql = "SELECT COUNT(#{column}) FROM #{tablename} #{end_clause}"
    count = map_values_in_one_column(query(sql), 'count')
    count.first.to_f
  end

  def max_workout_id
    sql = 'SELECT MAX(id) FROM workouts;'
    max = map_values_in_one_column(query(sql), 'max')
    max.first
  end

  def workout_details(workout_id)
    suffix = 'WHERE w.id = $1;'
    data = query(formulate_workout_query(suffix), workout_id)
    map_workout_data(data).first
  end

  def load_workouts_subset(offset)
    suffix = <<~SQL
      ORDER BY u.username, w.date DESC
      LIMIT 10 OFFSET $1;
    SQL
    sql = formulate_workout_query(suffix)
    raw_data = query(sql, offset)
    map_workout_data(raw_data)
  end

  def load_exercises(workout_id)
    end_clause = <<~SQL
      WHERE workout_id = $1
      ORDER BY description;
    SQL
    sql = formulate_exercise_query(end_clause)
    raw_data = query(sql, workout_id)
    map_exercise_data(raw_data)
  end

  def exercise_details(exercise_id)
    sql = formulate_exercise_query('WHERE id = $1;')
    raw_data = query(sql, exercise_id)
    map_exercise_data(raw_data).first
  end

  def valid_new_user?(name, password)
    ok_length = name.size <= 25 && password.size <= 25 && password.size > 10
    !unique_usernames.include?(name) && ok_length
  end

  def valid_login_credentials?(username, password)
    sql = 'SELECT password FROM users WHERE username = $1;'
    db_pw = query(sql, username)

    salted_pw = map_values_in_one_column(db_pw, 'password').first
    return false if salted_pw.nil?

    BCrypt::Password.new(salted_pw) == password
  end

  def invalid_new_exercise_msg(desc, weights, workout_id)
    return unless invalid_new_exercise?(desc, weights, workout_id)

    full_invalid_exercise_msg
  end

  def full_invalid_exercise_msg
    <<~MSG
      Invalid exercise entry. Please ensure you have not already
      added this particular exercise description to your workout,
      that your description is between 5 and 40 characters, and
      that the weight description provides a number and either
      'kgs' or 'lbs' as the unit, or 'bodyweight', if no additional
      weight was used.
    MSG
  end

  def invalid_exercise_edit_msg(desc, weights, workout_id)
    return unless invalid_exercise_edit?(desc, weights, workout_id)

    fragment_to_remove = "you have not already\n" \
                         "added this particular exercise description to your workout,\nthat "

    full_invalid_exercise_msg.gsub(fragment_to_remove, '')
  end

  def invalid_new_exercise?(desc, weights, workout_id)
    duplicate_exercise?(desc, workout_id) ||
      invalid_exercise_edit?(desc, weights, workout_id)
  end

  def invalid_exercise_edit?(desc, weights, _workout_id)
    exercise_desc_bad_length?(desc) ||
      exercise_weights_invalid?(weights)
  end

  def exercise_desc_bad_length?(desc)
    desc.size > 40 || desc.size < 5
  end

  def exercise_weights_invalid?(weights)
    nums_space = (0..9).to_a.map(&:to_s) << ' '
    allowed_units = %w[lbs kgs bodyweight]

    unit = weights.chars.reject do |char|
      nums_space.include?(char)
    end
    unit = unit.join.downcase

    weights.size > 10 || !allowed_units.include?(unit)
  end

  def duplicate_exercise?(description, workout_id)
    scrubbed_desc = description.downcase.gsub(/\s+/, '')
    exercises = load_exercises(workout_id)

    existing_descs = exercises.map do |exercise|
      exercise[:desc].downcase.gsub(/\s+/, '')
    end
    existing_descs.include?(scrubbed_desc)
  end

  def update_exercise!(desc, sets, reps, weight, id)
    sql = <<~SQL
      UPDATE exercises
        SET description = $1,
            num_sets = $2,
            num_reps = $3,
            weight_description = $4
        WHERE id = $5;
    SQL
    query(sql, desc, sets, reps, weight, id)
  end

  def update_workout!(name, date, id)
    sql = <<~SQL
      UPDATE workouts
        SET name = $1,
        "date" = $2
        WHERE id = $3;
    SQL
    query(sql, name, date, id)
  end

  def valid_workout_details?(name, date, username, workout_id)
    return false if name.size > 15 || name.size < 4

    suffix = workout_id ? "WHERE w.id != #{workout_id};" : ''
    data = query(formulate_workout_query(suffix))

    match_arr = map_workout_data(data).select do |workout|
      workout[:date] == date &&
        workout[:username] == username
    end
    match_arr.empty?
  end

  def invalid_workout_msg(name, date, username, workout_id)
    return if valid_workout_details?(name, date, username, workout_id)

    <<~MSG
      Invalid workout entry. You may only log 1 workout per day and
      the name of the workout must be within 4 & 15 characters long.
      Please try again.
    MSG
  end

  def add_workout!(name, date, user_id)
    sql = <<~SQL
      INSERT INTO workouts (name, "date", user_id)
        VALUES ($1, $2, $3);
    SQL
    query(sql, name, date, user_id)
  end

  def at_exercise_limit?(workout_id)
    end_clause = "WHERE workout_id = #{workout_id};"
    count = count('workout_id', 'exercises', end_clause)
    count == 10
  end

  def add_exercise!(desc, sets, reps, weights, workout_id)
    sql = <<~SQL
      INSERT INTO exercises
        (description, num_sets, num_reps,
        weight_description, workout_id)
          VALUES ($1, $2, $3, $4, $5);
    SQL
    query(sql, desc, sets, reps, weights, workout_id)
  end

  def add_user!(name, password)
    hashed_password = BCrypt::Password.create(password)
    sql = <<~SQL
      INSERT INTO users (username, password)
        VALUES ($1, $2);
    SQL
    query(sql, name, hashed_password)
  end

  def delete_record!(id, table)
    sql = "DELETE FROM #{table} WHERE id = $1;"
    query(sql, id)
  end

  private

  def query(sql, *parameters)
    @db.exec_params(sql, parameters)
  end

  def map_values_in_one_column(query_return, desired_value)
    query_return.map { |tuple| tuple[desired_value] }
  end

  def map_workout_data(query_return)
    query_return.map do |tuple|
      { id: tuple['id'].to_i,
        name: tuple['name'],
        date: tuple['date'],
        username: tuple['username'] }
    end
  end

  def map_exercise_data(query_return)
    query_return.map do |tuple|
      { id: tuple['id'].to_i,
        desc: tuple['description'],
        num_sets: tuple['num_sets'],
        num_reps: tuple['num_reps'],
        weight_desc: tuple['weight_description'] }
    end
  end

  def formulate_workout_query(end_clause)
    <<~SQL
      SELECT w.name, w.date, w.id, u.username
        FROM workouts AS w
          JOIN users AS u
          ON w.user_id = u.id
        #{end_clause}
    SQL
  end

  def formulate_exercise_query(end_clause)
    "SELECT * FROM exercises #{end_clause}"
  end

  def query_for_ids(table)
    "SELECT id FROM #{table};"
  end

  def unique_ids(table)
    sql = query_for_ids(table)
    map_values_in_one_column(query(sql), 'id')
  end
end
