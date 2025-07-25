import { render, screen } from '@testing-library/react';
import InstructorCourses from '../instructor/courses/page';

describe('InstructorCourses', () => {
  it('renders instructor courses heading', () => {
    render(<InstructorCourses />);
    expect(screen.getByText('Instructor Courses')).toBeInTheDocument();
  });
}); 