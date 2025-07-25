import { render, screen } from '@testing-library/react';
import InstructorDashboard from '../instructor/dashboard/page';

describe('InstructorDashboard', () => {
  it('renders instructor dashboard heading', () => {
    render(<InstructorDashboard />);
    expect(screen.getByText('Instructor Dashboard')).toBeInTheDocument();
  });
}); 