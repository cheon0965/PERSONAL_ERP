'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Grid, MenuItem, Stack, TextField } from '@mui/material';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const transactionSchema = z.object({
  title: z.string().min(2),
  amountWon: z.coerce.number().int().positive(),
  businessDate: z.string().min(1),
  type: z.enum(['INCOME', 'EXPENSE'])
});

type TransactionFormInput = z.infer<typeof transactionSchema>;

export function TransactionForm() {
  const form = useForm<TransactionFormInput>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      title: '',
      amountWon: 0,
      businessDate: '2026-03-19',
      type: 'EXPENSE'
    }
  });

  return (
    <form
      onSubmit={form.handleSubmit((values) => {
        console.log('transaction draft', values);
      })}
    >
      <Stack spacing={2.5}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField label="Title" {...form.register('title')} />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField label="Amount (KRW)" type="number" {...form.register('amountWon')} />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField label="Business Date" type="date" {...form.register('businessDate')} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField select label="Type" {...form.register('type')}>
              <MenuItem value="EXPENSE">Expense</MenuItem>
              <MenuItem value="INCOME">Income</MenuItem>
            </TextField>
          </Grid>
        </Grid>
        <Button type="submit" variant="contained" sx={{ alignSelf: 'flex-start' }}>
          Save Draft
        </Button>
      </Stack>
    </form>
  );
}
