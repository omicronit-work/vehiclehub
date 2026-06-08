import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { doc, setDoc } from 'firebase/firestore';

export const userApi = createApi({
  reducerPath: 'userApi',
  baseQuery: fakeBaseQuery(),
  endpoints: (builder) => ({
    saveUserInfo: builder.mutation({
      queryFn: async ({ name, email, photo }) => {
        try {
          await setDoc(doc('users', email), { name, email, photo });
          return { data: { name, email, photo } };
        } catch (error) {
          return { error: error.message };
        }
      },
    }),
  }),
});

export const { useSaveUserInfoMutation } = userApi;