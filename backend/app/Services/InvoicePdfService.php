<?php

namespace App\Services;

use App\Models\Order;
use Illuminate\Support\Str;

class InvoicePdfService
{
    private const NAVY = '0.039 0.102 0.216';

    private const BLUE = '0.145 0.388 0.922';

    private const INK = '0.059 0.090 0.165';

    private const MUTED = '0.392 0.455 0.557';

    private const LINE = '0.882 0.910 0.949';

    private const SOFT = '0.969 0.976 0.988';

    public function make(Order $order): string
    {
        $order->loadMissing(['user', 'project', 'plan', 'payments', 'coupon']);

        $successfulPayments = $order->payments->where('status', 'success')->sortBy('installment_no')->values();
        $paidAmount = (float) $successfulPayments->sum('amount');
        $balance = max(0, (float) $order->total - $paidAmount);
        $invoiceNumber = 'INV-'.str_pad((string) $order->id, 6, '0', STR_PAD_LEFT);
        $project = $order->project?->title ?: 'Project order';
        $plan = $order->plan?->name ?: 'One-time';
        $content = '';

        // Branded invoice header.
        $content .= $this->rect(0, 730, 595, 112, self::NAVY);
        $content .= $this->text('VIDISHA INNOVTECH', 38, 801, 18, true, '1 1 1');
        $content .= $this->text('Engineering Project Marketplace', 38, 781, 9, false, '0.749 0.843 0.980');
        $content .= $this->text('admin@vidishainnvotech.com  |  vidishainnvotechprojects.store', 38, 758, 8, false, '0.749 0.843 0.980');
        $content .= $this->text('INVOICE', 430, 804, 20, true, '1 1 1');
        $content .= $this->text($invoiceNumber, 430, 782, 10, true, '0.749 0.843 0.980');
        $content .= $this->text('Order #'.$order->id, 430, 763, 8, false, '0.749 0.843 0.980');

        // Customer and order summary cards.
        $content .= $this->sectionLabel('BILL TO', 36, 704);
        $content .= $this->sectionLabel('ORDER DETAILS', 309, 704);
        $content .= $this->card(36, 620, 250, 68);
        $content .= $this->card(309, 620, 250, 68);
        $content .= $this->text($this->limit($order->user?->name ?: 'Not available', 38), 50, 667, 11, true);
        $content .= $this->text($this->limit($order->user?->email ?: 'Not available', 46), 50, 649, 8, false, self::MUTED);
        $content .= $this->text($this->limit($order->user?->mobile ?: 'Phone not available', 38), 50, 633, 8, false, self::MUTED);
        $content .= $this->labelValue('Invoice date', $this->date($order->created_at), 323, 667);
        $content .= $this->labelValue('Order status', Str::headline((string) $order->status), 323, 647);
        $content .= $this->labelValue('Coupon', $order->coupon?->code ?: 'None', 323, 627);

        // Item table.
        $content .= $this->sectionLabel('INVOICE ITEMS', 36, 594);
        $content .= $this->rect(36, 548, 523, 28, self::NAVY);
        $content .= $this->text('DESCRIPTION', 48, 558, 8, true, '1 1 1');
        $content .= $this->text('PLAN', 330, 558, 8, true, '1 1 1');
        $content .= $this->text('QTY', 442, 558, 8, true, '1 1 1');
        $content .= $this->text('AMOUNT', 490, 558, 8, true, '1 1 1');
        $content .= $this->card(36, 488, 523, 60, '1 1 1');
        $content .= $this->wrappedText($project, 48, 525, 48, 10, true, 2, 14);
        $content .= $this->text($this->limit($plan, 20), 330, 520, 9, false, self::MUTED);
        $content .= $this->text('1', 446, 520, 9, true);
        $content .= $this->text($this->money($order->base_price), 486, 520, 9, true);

        // Price summary.
        $content .= $this->sectionLabel('PAYMENT SUMMARY', 334, 462);
        $content .= $this->summaryRow('Original price', $this->money($order->base_price), 334, 438);
        $content .= $this->summaryRow('Discount', '- '.$this->money($order->discount_amount), 334, 419);
        $content .= $this->line(334, 406, 559, 406, self::LINE);
        $content .= $this->summaryRow('Invoice total', $this->money($order->total), 334, 385, true);
        $content .= $this->summaryRow('Amount paid', $this->money($paidAmount), 334, 364);
        $content .= $this->rect(334, 326, 225, 27, '0.937 0.965 1');
        $content .= $this->text('BALANCE DUE', 346, 336, 8, true, self::BLUE);
        $content .= $this->rightText($this->money($balance), 547, 336, 10, true, self::BLUE);

        // Payment history table.
        $content .= $this->sectionLabel('PAYMENT HISTORY', 36, 462);
        $content .= $this->rect(36, 418, 272, 25, self::SOFT, self::LINE);
        $content .= $this->text('INSTALLMENT', 47, 427, 7, true, self::MUTED);
        $content .= $this->text('STATUS', 108, 427, 7, true, self::MUTED);
        $content .= $this->text('PAID AT', 156, 427, 7, true, self::MUTED);
        $content .= $this->text('AMOUNT', 258, 427, 7, true, self::MUTED);

        if ($order->payments->isEmpty()) {
            $content .= $this->text('No payments recorded for this order.', 47, 397, 9, false, self::MUTED);
        } else {
            $rowY = 393;
            foreach ($order->payments->sortBy('installment_no')->take(6) as $payment) {
                $content .= $this->line(36, $rowY - 8, 308, $rowY - 8, self::LINE);
                $content .= $this->text('#'.$payment->installment_no, 47, $rowY, 8, true);
                $content .= $this->text(Str::headline((string) $payment->status), 108, $rowY, 8, false, self::MUTED);
                $content .= $this->text($this->shortDate($payment->paid_at), 156, $rowY, 8, false, self::MUTED);
                $content .= $this->rightText($this->money($payment->amount), 298, $rowY, 8, true);
                $rowY -= 25;
            }
        }

        // Footer and authenticity note.
        $content .= $this->line(36, 76, 559, 76, self::LINE);
        $content .= $this->text('Thank you for choosing Vidisha InnoVTech.', 36, 54, 9, true, self::NAVY);
        $content .= $this->text('This is a computer-generated invoice and does not require a signature.', 36, 38, 7, false, self::MUTED);
        $content .= $this->rightText($invoiceNumber.'  |  '.$this->dateTime($order->created_at), 559, 38, 7, false, self::MUTED);

        return $this->render($content);
    }

    private function render(string $content): string
    {
        $objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
            '<< /Length '.strlen($content).">>\nstream\n{$content}endstream",
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
        ];

        $pdf = "%PDF-1.4\n";
        $offsets = [0];

        foreach ($objects as $index => $object) {
            $offsets[] = strlen($pdf);
            $number = $index + 1;
            $pdf .= "{$number} 0 obj\n{$object}\nendobj\n";
        }

        $xref = strlen($pdf);
        $pdf .= "xref\n0 ".(count($objects) + 1)."\n";
        $pdf .= "0000000000 65535 f \n";
        foreach (array_slice($offsets, 1) as $offset) {
            $pdf .= sprintf("%010d 00000 n \n", $offset);
        }
        $pdf .= "trailer\n<< /Size ".(count($objects) + 1)." /Root 1 0 R >>\n";
        $pdf .= "startxref\n{$xref}\n%%EOF";

        return $pdf;
    }

    private function sectionLabel(string $text, float $x, float $y): string
    {
        return $this->text($text, $x, $y, 8, true, self::BLUE);
    }

    private function card(float $x, float $y, float $width, float $height, string $fill = self::SOFT): string
    {
        return $this->rect($x, $y, $width, $height, $fill, self::LINE);
    }

    private function labelValue(string $label, string $value, float $x, float $y): string
    {
        return $this->text($label, $x, $y, 8, false, self::MUTED)
            .$this->text($this->limit($value, 30), $x + 74, $y, 8, true);
    }

    private function summaryRow(string $label, string $value, float $x, float $y, bool $bold = false): string
    {
        return $this->text($label, $x, $y, $bold ? 9 : 8, $bold, $bold ? self::INK : self::MUTED)
            .$this->rightText($value, 559, $y, $bold ? 10 : 8, true);
    }

    private function text(string $text, float $x, float $y, int $size = 10, bool $bold = false, string $color = self::INK): string
    {
        $font = $bold ? 'F2' : 'F1';

        return "q {$color} rg BT /{$font} {$size} Tf {$x} {$y} Td (".$this->escape($text).") Tj ET Q\n";
    }

    private function rightText(string $text, float $rightX, float $y, int $size = 10, bool $bold = false, string $color = self::INK): string
    {
        $estimatedWidth = strlen(Str::ascii($text)) * $size * ($bold ? 0.56 : 0.5);

        return $this->text($text, max(0, $rightX - $estimatedWidth), $y, $size, $bold, $color);
    }

    private function wrappedText(string $text, float $x, float $y, int $characters, int $size, bool $bold, int $lines, int $leading): string
    {
        $parts = explode("\n", wordwrap(Str::ascii($text), $characters, "\n", true));
        $content = '';

        foreach (array_slice($parts, 0, $lines) as $index => $part) {
            if ($index === $lines - 1 && count($parts) > $lines) {
                $part = rtrim($part, ' .').'...';
            }
            $content .= $this->text($part, $x, $y - ($index * $leading), $size, $bold);
        }

        return $content;
    }

    private function rect(float $x, float $y, float $width, float $height, string $fill, ?string $stroke = null): string
    {
        $command = "q {$fill} rg";
        if ($stroke) {
            $command .= " {$stroke} RG 0.7 w";
        }

        return $command." {$x} {$y} {$width} {$height} re ".($stroke ? 'B' : 'f')." Q\n";
    }

    private function line(float $x1, float $y1, float $x2, float $y2, string $color): string
    {
        return "q {$color} RG 0.7 w {$x1} {$y1} m {$x2} {$y2} l S Q\n";
    }

    private function escape(string $text): string
    {
        return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], Str::ascii($text));
    }

    private function limit(string $text, int $length): string
    {
        return Str::limit(Str::ascii($text), $length, '...');
    }

    private function money(mixed $value): string
    {
        return 'INR '.number_format((float) $value, 2);
    }

    private function date(mixed $value): string
    {
        return $value ? $value->timezone(config('app.timezone'))->format('d M Y') : 'Not available';
    }

    private function shortDate(mixed $value): string
    {
        return $value ? $value->timezone(config('app.timezone'))->format('d M, h:i A') : 'Pending';
    }

    private function dateTime(mixed $value): string
    {
        return $value ? $value->timezone(config('app.timezone'))->format('d M Y, h:i A') : 'Not available';
    }
}
