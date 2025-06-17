'use client';

import LoginForm from '@/components/auth/LoginForm';
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

export default function LoginPage() {
  return (
    <CenteredBox>
      <FormWrapper>
        <LoginForm />
      </FormWrapper>
    </CenteredBox>
  );
}
