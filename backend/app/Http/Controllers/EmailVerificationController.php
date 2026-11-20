<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

class EmailVerificationController extends Controller
{
    public function verify(
        Request $request,
        $id,
        $hash
    ) {
        $user = User::findOrFail($id);

        if (
            ! hash_equals(
                sha1($user->getEmailForVerification()),
                $hash
            )
        ) {
            return response()->json([
                'message' => 'Invalid verification link.',
            ], 403);
        }

        if (! $user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();
        }

        /*
         * When the verification link is opened
         * directly from the email/browser, send
         * the user to the React verification page.
         *
         * The original signed query parameters
         * are preserved.
         */
        if (
            ! $request->expectsJson() &&
            ! $request->ajax()
        ) {
            $query = http_build_query(
                $request->query()
            );

            $frontendUrl = rtrim(
                config(
                    'app.frontend_url',
                    'http://localhost:5173'
                ),
                '/'
            );

            $redirectUrl =
                $frontendUrl.
                '/email/verify/'.
                $id.
                '/'.
                $hash;

            if ($query !== '') {
                $redirectUrl .= '?'.$query;
            }

            return redirect()->away(
                $redirectUrl
            );
        }

        return response()->json([
            'message' => 'Email verified successfully.',
            'verified' => true,
        ]);
    }

    public function resend(Request $request)
    {
        $validated = $request->validate([
            'email' => [
                'required',
                'email',
            ],
        ]);

        $user = User::where(
            'email',
            $validated['email']
        )->first();

        /*
         * Do not reveal whether an email exists.
         */
        if (! $user) {
            return response()->json([
                'message' => 'If an account exists for this email, a verification email will be sent.',
            ]);
        }

        if ($user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Email is already verified.',
                'verified' => true,
            ]);
        }

        $user->sendEmailVerificationNotification();

        return response()->json([
            'message' => 'Verification email sent successfully.',
            'verified' => false,
        ]);
    }
}
