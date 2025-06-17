'use client';

import SignupForm from '@/components/auth/SignupForm';
import { Box, styled } from '@mui/material';

const CenteredBox = styled(Box)({
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'inherit',
  padding: 16,
});

const FormWrapper = styled(Box)({
  width: '100%',
  maxWidth: 520,
});

export default function SignupPage() {
  return (
    <CenteredBox>
      <FormWrapper>
        <SignupForm />
      </FormWrapper>
    </CenteredBox>
  );
}
