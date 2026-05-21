# frozen_string_literal: true

# Query and mapping helpers for DatabaseAccess.
module DatabaseAccessQueryHelpers
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
