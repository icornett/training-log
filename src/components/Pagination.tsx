import { Link } from 'react-router-dom'

interface PaginationProps {
  pageNumber: number
  totalPages: number
}

export const Pagination = ({ pageNumber, totalPages }: PaginationProps): JSX.Element => {
  const prior = pageNumber <= 1 ? totalPages : pageNumber - 1
  const next = pageNumber >= totalPages ? 1 : pageNumber + 1

  return (
    <div className="pager">
      <Link to={`/training_log/${prior}/workouts`}>Prior Page</Link>
      <span>
        Page {pageNumber} of {totalPages}
      </span>
      <Link to={`/training_log/${next}/workouts`}>Next Page</Link>
    </div>
  )
}
