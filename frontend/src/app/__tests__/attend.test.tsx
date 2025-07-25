import { render, screen, fireEvent } from '@testing-library/react';
import AttendPage from '../attend/[token]/page';

jest.mock('next/navigation', () => ({
  useParams: () => ({ token: 'testtoken' })
}));

describe('AttendPage', () => {
  it('renders attendance form', () => {
    render(<AttendPage />);
    expect(screen.getByText('Attendance Form')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Surname')).toBeInTheDocument();
  });
}); 