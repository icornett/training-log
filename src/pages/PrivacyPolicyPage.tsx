import { Link } from 'react-router-dom'

export const PrivacyPolicyPage = (): JSX.Element => {
  return (
    <section className="card">
      <h1>Privacy Policy</h1>
      <div className="privacy-content">
        <p>
          We collect as little data as possible. To use the app, we store a login identifier and
          the workout or weight data you choose to enter. We do not require your real name, email
          address, or phone number. We do not sell data, run ads, or do cross-site tracking. You
          can export your data in CSV or JSON format at any time. If you request deletion, your
          account and associated data will be permanently removed within 30 days.
        </p>
      </div>
      <p>
        <Link to="/signup">Back to signup</Link>
      </p>
    </section>
  )
}