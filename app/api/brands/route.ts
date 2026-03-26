import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const brandSchema = z.object({
  registrationType: z.enum(['individual', 'company']),
  name: z.string().optional(),
  companyName: z.string().optional(),
  email: z.string().email(),
  phone: z.string().min(1),
  country: z.string().min(1),
  city: z.string().min(1),
  streetAddress: z.string().optional(),
  buildingNumber: z.string().optional(),
  registrationCountry: z.string().min(1),
  typeOfWork: z.string().optional(),
  poaFileUrl: z.string().url(),
  logoFileUrl: z.string().url(),
  businessLicenseUrl: z.string().url().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedData = brandSchema.parse(body);

    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Validate required fields based on registration type
    if (validatedData.registrationType === 'company' && !validatedData.companyName) {
      return NextResponse.json(
        { error: 'Company name is required for company registration' },
        { status: 400 }
      );
    }

    if (validatedData.registrationType === 'individual' && !validatedData.name) {
      return NextResponse.json(
        { error: 'Name is required for individual registration' },
        { status: 400 }
      );
    }

    // Insert brand registration
    const { data: brand, error } = await supabase
      .from('brands')
      .insert({
        user_id: user.id,
        registration_type: validatedData.registrationType,
        name: validatedData.name,
        company_name: validatedData.companyName,
        email: validatedData.email,
        phone: validatedData.phone,
        country: validatedData.country,
        city: validatedData.city,
        street_address: validatedData.streetAddress,
        building_number: validatedData.buildingNumber,
        registration_country: validatedData.registrationCountry,
        type_of_work: validatedData.typeOfWork,
        poa_file_url: validatedData.poaFileUrl,
        logo_file_url: validatedData.logoFileUrl,
        business_license_url: validatedData.businessLicenseUrl,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'Brand registration submitted successfully',
      brand,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { data: brands, error } = await supabase
      .from('brands')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ brands });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
