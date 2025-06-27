'use client';

import SignupForm from '@/components/auth/SignupForm';
import { Box, styled, Button } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import { useRouter } from 'next/navigation';

const CenteredBox = styled(Box)({
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'inherit',
  padding: 16,
  flexDirection: 'column',
});

const FormWrapper = styled(Box)({
  width: '100%',
  maxWidth: 520,
});

const TopButtonBox = styled(Box)({
  width: '100%',
  maxWidth: 520,
  display: 'flex',
  justifyContent: 'flex-start',
  marginBottom: 16,
});

export default function SignupPage() {
  const router = useRouter();
  return (
    <CenteredBox>
      <TopButtonBox>
        <Button
          startIcon={<HomeIcon />}
          variant="text"
          color="primary"
          onClick={() => router.push('/')}
        >
          Back to Home
        </Button>
      </TopButtonBox>
      <FormWrapper>
        <SignupForm />
      </FormWrapper>
    </CenteredBox>
  );
}
