# frozen_string_literal: true

require 'pg'

require_relative 'database_access_connection_config'
require_relative 'database_access_query_helpers'
require_relative 'database_access_validation'

# Manages database interactions for the training log application
class DatabaseAccess
  include DatabaseAccessConnectionConfig
  include DatabaseAccessQueryHelpers
  include DatabaseAccessValidation

  def initialize
    @db = PG.connect(connection_config)
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
end
