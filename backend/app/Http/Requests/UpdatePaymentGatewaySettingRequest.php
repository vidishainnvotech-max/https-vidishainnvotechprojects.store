<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePaymentGatewaySettingRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->role === 'admin';
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'mode' => ['required', Rule::in(['test', 'live'])],
            'test_key_id' => ['nullable', 'string', 'max:255', 'starts_with:rzp_test_'],
            'test_key_secret' => ['nullable', 'string', 'max:255'],
            'live_key_id' => ['nullable', 'string', 'max:255', 'starts_with:rzp_live_'],
            'live_key_secret' => ['nullable', 'string', 'max:255'],
        ];
    }
}
