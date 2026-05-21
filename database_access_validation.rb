# frozen_string_literal: true

# Validation and credential helpers for DatabaseAccess.
module DatabaseAccessValidation
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
end
